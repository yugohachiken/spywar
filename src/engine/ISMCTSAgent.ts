import { Action, Card, Player } from '../types/spywar';
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
  rolloutDepth: number;

  constructor(iterations: number = 120, rolloutDepth: number = 4) {
    this.iterations = iterations;
    this.rolloutDepth = rolloutDepth;
  }

  getEffectiveRolloutDepth(): number {
    if (this.rolloutDepth) return this.rolloutDepth;
    if (this.iterations <= 30) return 2;
    if (this.iterations <= 80) return 3;
    if (this.iterations <= 200) return 4;
    if (this.iterations <= 400) return 5;
    return 6;
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

    // Casual/Novice blunder heuristic for very low difficulty (iterations <= 30)
    if (this.iterations <= 30 && legalActions.length > 1) {
      const blunderChance = this.iterations <= 15 ? 0.20 : 0.08;
      if (Math.random() < blunderChance) {
        const nonPass = legalActions.filter(a => a.type !== 'PASS');
        const pool = nonPass.length > 0 ? nonPass : legalActions;
        return pool[Math.floor(Math.random() * pool.length)];
      }
    }

    const root = new MCTSNode(null, null, activePlayer.pid);
    root.untriedActions = [...legalActions];
    const maxRolloutDepth = this.getEffectiveRolloutDepth();

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
          simEngine.executeAction(simPlayer, simOpp, this.bindActionToSim(simEngine, node.action));
        }
      }

      // 3. Expansion
      if (node.untriedActions && node.untriedActions.length > 0) {
        const randIdx = Math.floor(Math.random() * node.untriedActions.length);
        const [act] = node.untriedActions.splice(randIdx, 1);
        simEngine.executeAction(simPlayer, simOpp, this.bindActionToSim(simEngine, act));

        const childNode = new MCTSNode(act, node, activePlayer.pid);
        childNode.untriedActions = simEngine.getLegalActions(simPlayer, simOpp);
        node.children.push(childNode);
        node = childNode;
      }

      // 4. Rollout (lightweight random simulation)
      let depth = 0;
      while (depth < maxRolloutDepth && !simEngine.gameOver) {
        const acts = simEngine.getLegalActions(simPlayer, simOpp);
        if (!acts || acts.length === 0) break;
        // Prioritize non-pass actions in rollout so AI explores proactive plays
        const nonPassActs = acts.filter(a => a.type !== 'PASS');
        const candidateActs = (nonPassActs.length > 0 && Math.random() < 0.75) ? nonPassActs : acts;
        const randomAct = candidateActs[Math.floor(Math.random() * candidateActs.length)];
        simEngine.executeAction(simPlayer, simOpp, this.bindActionToSim(simEngine, randomAct));
        if (randomAct.type === 'PASS') break;
        depth++;
      }

      // 5. Evaluation & Backpropagation
      let reward = (simPlayer.mission_points - simOpp.mission_points) * 12;
      for (const m of simEngine.missionsOnTable) {
        const myTokens = m.tokens[simPlayer.pid] || 0;
        const oppTokens = m.tokens[simOpp.pid] || 0;
        reward += (myTokens - oppTokens) * 3;
        if (myTokens >= m.req) reward += (m.points || 1) * 8;
        if (oppTokens >= m.req) reward -= (m.points || 1) * 8;
      }
      reward += (simEngine.getTotalSpendableCoins(simPlayer) - simEngine.getTotalSpendableCoins(simOpp)) * 0.5;

      // Field presence evaluation (rewarding ready operatives)
      const myOps = simPlayer.battlefield.filter(c => c.type === 'Operative');
      const oppOps = simOpp.battlefield.filter(c => c.type === 'Operative');
      reward += (myOps.length - oppOps.length) * 1.5;

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
    clone.firstPlayerIndex = source.firstPlayerIndex;
    clone.turnsInCurrentRound = source.turnsInCurrentRound;
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

  private bindActionToSim(simEngine: SpywarEngine, act: Action): Action {
    if (!act) return act;
    const allCards = simEngine.players.flatMap(p => [
      ...p.hand,
      ...p.battlefield,
      p.affiliation
    ].filter(Boolean) as Card[]);

    const clean: Action = { ...act };
    if (act.cardId) {
      clean.card = allCards.find(c => c.id === act.cardId) || (act.card ? { ...act.card } : undefined);
    } else if (act.card) {
      clean.card = allCards.find(c => c.name === act.card?.name) || { ...act.card };
    }

    if (act.targetId) {
      clean.targetCard = allCards.find(c => c.id === act.targetId) || (act.targetCard ? { ...act.targetCard } : undefined);
    } else if (act.targetCard) {
      clean.targetCard = allCards.find(c => c.name === act.targetCard?.name) || { ...act.targetCard };
    }

    if (act.attackerCards) {
      clean.attackerCards = act.attackerCards.map(a => allCards.find(c => c.id === a.id) || { ...a });
    }
    if (act.defenderCards) {
      clean.defenderCards = act.defenderCards.map(d => allCards.find(c => c.id === d.id) || { ...d });
    }

    return clean;
  }
}
