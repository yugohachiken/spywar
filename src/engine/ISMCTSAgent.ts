import { Action, Player } from '../types/spywar';
import { SpywarEngine } from './SpywarEngine';

export class MCTSNode {
  action: Action | null;
  parent: MCTSNode | null;
  activePid: 'P1' | 'P2';
  children: MCTSNode[];
  visits: number;
  totalValue: number;
  untriedActions: Action[] | null;

  constructor(action: Action | null = null, parent: MCTSNode | null = null, activePid: 'P1' | 'P2' = 'P1') {
    this.action = action;
    this.parent = parent;
    this.activePid = activePid;
    this.children = [];
    this.visits = 0;
    this.totalValue = 0;
    this.untriedActions = null;
  }

  selectChild(c: number = 1.414): MCTSNode {
    let bestChild: MCTSNode = this.children[0];
    let bestUct = -Infinity;

    for (const child of this.children) {
      const exploit = child.totalValue / (child.visits || 1);
      const explore = Math.sqrt(Math.log(this.visits + 1) / (child.visits || 1));
      const uct = exploit + c * explore;
      if (uct > bestUct) {
        bestUct = uct;
        bestChild = child;
      }
    }
    return bestChild;
  }
}

export class ISMCTSAgent {
  iterations: number;

  constructor(iterations: number = 40) {
    this.iterations = iterations;
  }

  getBestAction(engine: SpywarEngine, activePlayer: Player, opponent: Player): Action {
    const legalActions = engine.getLegalActions(activePlayer, opponent).filter(a => !a.disabled);
    if (legalActions.length <= 1) {
      return legalActions[0] || { type: 'PASS', desc: 'Pass turn' };
    }

    // High-priority heuristic: If Global Dominion Plan is playable, execute immediately!
    const winAction = legalActions.find(a => a.cardName === 'Global Dominion Plan');
    if (winAction) return winAction;

    // High-priority heuristic: If AI has unexhausted production and 0 active turn coins, produce resources
    const tapProd = legalActions.find(a => a.type === 'TAP_PROD');
    if (tapProd && activePlayer.current_turn_coins === 0) {
      return tapProd;
    }

    const root = new MCTSNode(null, null, activePlayer.pid);
    root.untriedActions = [...legalActions];

    for (let iter = 0; iter < this.iterations; iter++) {
      // 1. Determinization: Clone state and shuffle hidden information (opponent hand + draw deck)
      const simEngine = this.cloneEngineForSimulation(engine, activePlayer.pid, opponent.pid);
      const simPlayer = simEngine.players.find(p => p.pid === activePlayer.pid)!;
      const simOpp = simEngine.players.find(p => p.pid === opponent.pid)!;

      // 2. Selection
      let node = root;
      while (node.untriedActions && node.untriedActions.length === 0 && node.children.length > 0) {
        node = node.selectChild();
        if (node.action) {
          simEngine.executeAction(simPlayer, simOpp, node.action);
        }
      }

      // 3. Expansion
      if (node.untriedActions && node.untriedActions.length > 0) {
        const randIdx = Math.floor(Math.random() * node.untriedActions.length);
        const [act] = node.untriedActions.splice(randIdx, 1);
        simEngine.executeAction(simPlayer, simOpp, act);

        const childNode = new MCTSNode(act, node, activePlayer.pid);
        childNode.untriedActions = simEngine.getLegalActions(simPlayer, simOpp);
        node.children.push(childNode);
        node = childNode;
      }

      // 4. Rollout (lightweight random simulation)
      let depth = 0;
      while (depth < 4 && !simEngine.gameOver) {
        const acts = simEngine.getLegalActions(simPlayer, simOpp);
        if (!acts || acts.length === 0) break;
        // Prioritize non-pass actions in rollout so AI explores proactive plays
        const nonPassActs = acts.filter(a => a.type !== 'PASS');
        const candidateActs = (nonPassActs.length > 0 && Math.random() < 0.75) ? nonPassActs : acts;
        const randomAct = candidateActs[Math.floor(Math.random() * candidateActs.length)];
        simEngine.executeAction(simPlayer, simOpp, randomAct);
        if (randomAct.type === 'PASS') break;
        depth++;
      }

      // 5. Evaluation & Backpropagation
      let reward = (simPlayer.mission_points - simOpp.mission_points) * 10;
      for (const m of simEngine.missionsOnTable) {
        reward += ((m.tokens[simPlayer.pid] || 0) - (m.tokens[simOpp.pid] || 0)) * 2;
      }
      reward += (simEngine.getTotalSpendableCoins(simPlayer) - simEngine.getTotalSpendableCoins(simOpp)) * 0.5;

      let curr: MCTSNode | null = node;
      while (curr) {
        curr.visits++;
        curr.totalValue += reward;
        curr = curr.parent;
      }
    }

    if (root.children.length === 0) {
      return legalActions[0];
    }

    // Pick most visited child for robustness
    let mostVisited = root.children[0];
    for (const child of root.children) {
      if (child.visits > mostVisited.visits) {
        mostVisited = child;
      }
    }

    return mostVisited.action || legalActions[0];
  }

  private cloneEngineForSimulation(source: SpywarEngine, myPid: string, oppPid: string): SpywarEngine {
    const clone = new SpywarEngine(source.config);
    clone.currentRound = source.currentRound;
    clone.currentPhase = source.currentPhase;
    clone.activePlayerIndex = source.activePlayerIndex;
    clone.actionCounter = source.actionCounter;
    clone.gameOver = source.gameOver;
    clone.drawDeck = source.drawDeck.map(c => ({ ...c }));
    clone.missionsOnTable = source.missionsOnTable.map(m => ({ ...m, tokens: { ...m.tokens } }));

    clone.players = source.players.map(p => ({
      ...p,
      affiliation: p.affiliation ? { ...p.affiliation } : null,
      pendingFreeDeploys: p.pendingFreeDeploys ? { ...p.pendingFreeDeploys } : undefined,
      hand: p.hand.map(c => ({ ...c })),
      battlefield: p.battlefield.map(c => ({ ...c })),
      discard_pile: p.discard_pile.map(c => ({ ...c })),
      completed_missions: p.completed_missions.map(m => ({ ...m })),
      telemetry: {
        ...p.telemetry,
        uniqueOpTypesThisTurn: new Set(p.telemetry.uniqueOpTypesThisTurn)
      }
    }));

    // Determinization: Shuffle opponent hand with draw deck so AI doesn't peek into private cards
    const opp = clone.players.find(p => p.pid === oppPid)!;
    const combinedHidden = [...opp.hand, ...clone.drawDeck].sort(() => Math.random() - 0.5);
    opp.hand = combinedHidden.splice(0, opp.hand.length);
    clone.drawDeck = combinedHidden;

    return clone;
  }
}
