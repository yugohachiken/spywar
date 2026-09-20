import { Card, Mission, Player, Action, LogEntry, TurnTelemetry, TurnPhase } from '../types/spywar';
import { AFFILIATION_CARDS, LOCATION_CARDS, OPERATIVE_CARDS, SUPPORT_CARDS, MASTER_MISSIONS } from './cardManifest';

export interface EngineConfig {
  rounds: number;
  cardsDrawnPerTurn: number;
  maxHandSize: number;
  pointsToWin: number;
  affiliationMaxCap: number;
  operativeSummonState: 'R' | 'E';
  locationSummonState: 'R' | 'E';
  startingMissionCards: number;
  maxMissionsInPlay: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  rounds: 5,
  cardsDrawnPerTurn: 2,
  maxHandSize: 5,
  pointsToWin: 0,
  affiliationMaxCap: 5,
  operativeSummonState: 'R',
  locationSummonState: 'R',
  startingMissionCards: 1,
  maxMissionsInPlay: 0
};

export class SpywarEngine {
  config: EngineConfig;
  players: Player[];
  drawDeck: Card[];
  missionDeck: Mission[];
  missionsOnTable: Mission[];
  currentRound: number;
  currentPhase: TurnPhase;
  activePlayerIndex: number;
  actionCounter: number;
  logs: LogEntry[];
  gameOver: boolean;
  winner: Player | null;
  winReason: string;
  activeDeckName?: string;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.players = [this.createPlayer('Player 1', 'P1', false), this.createPlayer('Player 2 (AI)', 'P2', true)];
    this.drawDeck = [];
    this.missionDeck = [];
    this.missionsOnTable = [];
    this.currentRound = 0;
    this.currentPhase = 'OPERATIONS';
    this.activePlayerIndex = 0;
    this.actionCounter = 0;
    this.logs = [];
    this.gameOver = false;
    this.winner = null;
    this.winReason = '';
  }

  setGameMode(mode: 'human_vs_ai' | 'ai_vs_ai' | 'pass_and_play' | 'online_multiplayer') {
    if (mode === 'human_vs_ai') {
      this.players[0].isAI = false;
      this.players[1].isAI = true;
      this.players[0].name = 'Player 1';
      this.players[1].name = 'Player 2 (AI)';
    } else if (mode === 'ai_vs_ai') {
      this.players[0].isAI = true;
      this.players[1].isAI = true;
      this.players[0].name = 'Player 1 (AI)';
      this.players[1].name = 'Player 2 (AI)';
    } else if (mode === 'pass_and_play') {
      this.players[0].isAI = false;
      this.players[1].isAI = false;
      this.players[0].name = 'Player 1 (Human)';
      this.players[1].name = 'Player 2 (Human)';
    } else if (mode === 'online_multiplayer') {
      this.players[0].isAI = false;
      this.players[1].isAI = false;
      this.players[0].name = 'Agent 1';
      this.players[1].name = 'Agent 2';
    }
  }

  createPlayer(name: string, pid: 'P1' | 'P2', isAI: boolean): Player {
    return {
      id: pid,
      pid,
      name,
      isAI,
      affiliation: null,
      current_turn_coins: 0,
      hand: [],
      battlefield: [],
      discard_pile: [],
      completed_missions: [],
      mission_points: 0,
      telemetry: {
        eliminatedEnemyOpThisTurn: false,
        raidedCoinsThisTurn: 0,
        discardedCardFromHandThisTurn: false,
        operationsConductedThisTurn: 0,
        playedNamedThisTurn: false,
        uniqueOpTypesThisTurn: new Set<string>(),
        cardsPlayedThisTurn: 0
      }
    };
  }

  resetTurnTelemetry(player: Player) {
    player.telemetry = {
      eliminatedEnemyOpThisTurn: false,
      raidedCoinsThisTurn: 0,
      discardedCardFromHandThisTurn: false,
      operationsConductedThisTurn: 0,
      playedNamedThisTurn: false,
      uniqueOpTypesThisTurn: new Set<string>(),
      cardsPlayedThisTurn: 0
    };
    // Reset temp buffs
    for (const card of player.battlefield) {
      card.tempOffenseBuff = 0;
      card.tempDefenseBuff = 0;
    }
  }

  log(pid: 'P1' | 'P2', code: string, details: string) {
    this.actionCounter++;
    const player = this.players.find(p => p.pid === pid)!;
    const balanceStr = this.getCoinBalanceStr(player);
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      round: this.currentRound,
      actionNumber: this.actionCounter,
      pid,
      code,
      details,
      balanceStr,
      timestamp: Date.now()
    };
    this.logs.unshift(entry);
  }

  getCoinBalanceStr(player: Player): string {
    return `[Coins: ${this.getTotalSpendableCoins(player)} (Turn: ${player.current_turn_coins}, Stored: ${this.getStoredCoins(player)})]`;
  }

  getStoredCoins(player: Player): number {
    let stored = player.affiliation?.stored_coins || 0;
    for (const card of player.battlefield) {
      if (card.type === 'Location') {
        stored += card.stored_coins || 0;
      }
    }
    return stored;
  }

  getTotalSpendableCoins(player: Player): number {
    return player.current_turn_coins + this.getStoredCoins(player);
  }

  spendCoins(player: Player, amount: number): boolean {
    if (amount > this.getTotalSpendableCoins(player)) return false;

    let remaining = amount;
    // 1. Spend from floating turn pool first
    const fromFloating = Math.min(player.current_turn_coins, remaining);
    player.current_turn_coins -= fromFloating;
    remaining -= fromFloating;

    // 2. Spend from affiliation stored coins
    if (remaining > 0 && player.affiliation) {
      const affStored = player.affiliation.stored_coins || 0;
      const fromAff = Math.min(affStored, remaining);
      player.affiliation.stored_coins = affStored - fromAff;
      remaining -= fromAff;
    }

    // 3. Spend from locations stored coins
    if (remaining > 0) {
      for (const card of player.battlefield) {
        if (card.type === 'Location') {
          const locStored = card.stored_coins || 0;
          const fromLoc = Math.min(locStored, remaining);
          card.stored_coins = locStored - fromLoc;
          remaining -= fromLoc;
          if (remaining <= 0) break;
        }
      }
    }
    return true;
  }

  storeCoinsDirectly(player: Player, amount: number): { stored: number; excess: number } {
    if (amount <= 0) return { stored: 0, excess: 0 };
    const targets: Card[] = [];
    if (player.affiliation) targets.push(player.affiliation);
    targets.push(...player.battlefield.filter(c => c.type === 'Location'));

    let remaining = amount;
    let coinsStored = 0;
    let allocated = true;
    while (remaining > 0 && allocated) {
      allocated = false;
      for (const target of targets) {
        const cap = target.type === 'Affiliation' ? (target.cap ?? this.config.affiliationMaxCap) : (target.cap ?? target.production ?? 1);
        const current = target.stored_coins || 0;
        if (current < cap && remaining > 0) {
          target.stored_coins = current + 1;
          remaining--;
          coinsStored++;
          allocated = true;
        }
      }
    }
    // Any remaining coins that could not fit into storage enter active player's floating pool
    player.current_turn_coins += remaining;
    return { stored: coinsStored, excess: remaining };
  }

  storeRemainingCoins(player: Player): { stored: number; discarded: number } {
    if (player.current_turn_coins <= 0) return { stored: 0, discarded: 0 };

    const targets: Card[] = [];
    if (player.affiliation) targets.push(player.affiliation);
    targets.push(...player.battlefield.filter(c => c.type === 'Location'));

    let coinsStored = 0;
    let allocated = true;
    while (player.current_turn_coins > 0 && allocated) {
      allocated = false;
      for (const target of targets) {
        // Rule 2.3.7: Affiliation capacity = affiliationMaxCap; Location capacity = Production value (or cap)
        const cap = target.type === 'Affiliation' ? (target.cap ?? this.config.affiliationMaxCap) : (target.cap ?? target.production ?? 1);
        const current = target.stored_coins || 0;
        if (current < cap && player.current_turn_coins > 0) {
          target.stored_coins = current + 1;
          player.current_turn_coins--;
          coinsStored++;
          allocated = true;
        }
      }
    }

    const discarded = player.current_turn_coins;
    player.current_turn_coins = 0;
    return { stored: coinsStored, discarded };
  }

  setupGame(customDeckPayload?: {
    affiliationDeck?: Card[];
    drawDeck?: Card[];
    missions?: Mission[];
    deckName?: string;
  }) {
    this.logs = [];
    this.gameOver = false;
    this.winner = null;
    this.winReason = '';
    this.currentRound = 0;
    this.actionCounter = 0;
    this.activeDeckName = customDeckPayload?.deckName || 'Standard Deck';

    let affDeck: Card[] = [];
    let locDeck: Card[] = [];
    let opDeck: Card[] = [];
    let supDeck: Card[] = [];

    if (customDeckPayload && customDeckPayload.drawDeck && customDeckPayload.drawDeck.length >= 6) {
      affDeck = (customDeckPayload.affiliationDeck && customDeckPayload.affiliationDeck.length >= 2)
        ? [...customDeckPayload.affiliationDeck].sort(() => Math.random() - 0.5)
        : [...AFFILIATION_CARDS].sort(() => Math.random() - 0.5);

      const allDraw = [...customDeckPayload.drawDeck].sort(() => Math.random() - 0.5);
      // Separate for starting hands if possible
      locDeck = allDraw.filter(c => c.type === 'Location');
      opDeck = allDraw.filter(c => c.type === 'Operative');
      supDeck = allDraw.filter(c => c.type === 'Support');

      this.missionDeck = (customDeckPayload.missions && customDeckPayload.missions.length > 0)
        ? [...customDeckPayload.missions].map(m => ({ ...m, tokens: { P1: 0, P2: 0 } })).sort(() => Math.random() - 0.5)
        : [...MASTER_MISSIONS].map(m => ({ ...m, tokens: { P1: 0, P2: 0 } })).sort(() => Math.random() - 0.5);
    } else {
      affDeck = [...AFFILIATION_CARDS].sort(() => Math.random() - 0.5);
      LOCATION_CARDS.forEach(c => {
        const qty = c.qty || 1;
        for (let i = 0; i < qty; i++) locDeck.push({ ...c, id: `${c.id}_${i}` });
      });
      OPERATIVE_CARDS.forEach(c => {
        const qty = c.qty || 1;
        for (let i = 0; i < qty; i++) opDeck.push({ ...c, id: `${c.id}_${i}` });
      });
      SUPPORT_CARDS.forEach(c => {
        const qty = c.qty || 1;
        for (let i = 0; i < qty; i++) supDeck.push({ ...c, id: `${c.id}_${i}` });
      });

      locDeck.sort(() => Math.random() - 0.5);
      opDeck.sort(() => Math.random() - 0.5);
      supDeck.sort(() => Math.random() - 0.5);

      this.missionDeck = [...MASTER_MISSIONS].map(m => ({
        ...m,
        tokens: { P1: 0, P2: 0 }
      })).sort(() => Math.random() - 0.5);
    }

    this.missionsOnTable = [];

    // Draft Affiliation and starting 3 cards
    for (const p of this.players) {
      const aff = affDeck.pop() || AFFILIATION_CARDS[0];
      p.affiliation = { 
        ...aff, 
        cap: this.config.affiliationMaxCap,
        stored_coins: 0, 
        exhausted: false 
      };

      // Starting hand: 1 Location, 1 Operative, 1 Support (or any available 3 cards)
      const handCard1 = locDeck.pop() || opDeck.pop() || supDeck.pop();
      const handCard2 = opDeck.pop() || locDeck.pop() || supDeck.pop();
      const handCard3 = supDeck.pop() || opDeck.pop() || locDeck.pop();
      p.hand = [handCard1, handCard2, handCard3].filter((c): c is Card => !!c);

      p.battlefield = [];
      p.discard_pile = [];
      p.completed_missions = [];
      p.mission_points = 0;
      this.resetTurnTelemetry(p);
    }

    // Determine Initiative (highest production goes first)
    if ((this.players[1].affiliation?.production || 0) > (this.players[0].affiliation?.production || 0)) {
      this.players.reverse();
      this.players[0].pid = 'P1';
      this.players[1].pid = 'P2';
    }

    this.drawDeck = [...locDeck, ...opDeck, ...supDeck].sort(() => Math.random() - 0.5);
    this.activePlayerIndex = 0;

    this.log('P1', 'SETUP', `Game initialized with '${this.activeDeckName}'. P1 drafted '${this.players[0].affiliation?.name}' (Prod: ${this.players[0].affiliation?.production}, Cap: ${this.config.affiliationMaxCap}), P2 drafted '${this.players[1].affiliation?.name}' (Prod: ${this.players[1].affiliation?.production}, Cap: ${this.config.affiliationMaxCap}).`);
    this.startRound(1);
  }

  startRound(roundNumber: number) {
    this.currentRound = roundNumber;
    const maxMissions = this.config.maxMissionsInPlay || 0;
    const missionsToDraw = roundNumber === 1 
      ? Math.max(1, Math.min(this.config.startingMissionCards || 1, this.missionDeck.length)) 
      : 1;

    let drawn = 0;
    for (let i = 0; i < missionsToDraw; i++) {
      if (maxMissions > 0 && this.missionsOnTable.length >= maxMissions) {
        this.log(this.getActivePlayer().pid, 'MISSION-CAP', `Maximum Mission Cards in Play reached (${this.missionsOnTable.length}/${maxMissions}). No new mission drawn.`);
        break;
      }
      if (this.missionDeck.length > 0) {
        const newMission = this.missionDeck.pop()!;
        newMission.tokens = { P1: 0, P2: 0 };
        this.missionsOnTable.push(newMission);
        drawn++;
      }
    }
    this.log(this.getActivePlayer().pid, 'MISSION-REVEAL', `Round ${roundNumber} Table Missions (${this.missionsOnTable.length}${maxMissions > 0 ? `/${maxMissions} max` : ''}): ${this.missionsOnTable.map(m => `'${m.name}' (${m.points} pts)`).join(', ')}.`);
    this.startPlayerTurn(0);
  }

  startPlayerTurn(playerIndex: number) {
    this.activePlayerIndex = playerIndex;
    this.currentPhase = 'DRAW';
    const player = this.players[playerIndex];
    this.resetTurnTelemetry(player);

    // Rule 2.1.1: Refresh active player's cards to Ready (R). Opponent's cards remain exhausted!
    if (player.affiliation) player.affiliation.exhausted = false;
    for (const card of player.battlefield) {
      card.exhausted = false;
    }

    // Rule 2.2: Active player starts by drawing cardsDrawnPerTurn cards from draw pile
    const drawn: string[] = [];
    for (let i = 0; i < this.config.cardsDrawnPerTurn; i++) {
      if (this.drawDeck.length > 0) {
        const c = this.drawDeck.pop()!;
        player.hand.push(c);
        drawn.push(c.name);
      }
    }

    // Hand limit enforcement (Rule 2.2: maximum hand limit from maxHandSize)
    if (player.isAI && player.hand.length > this.config.maxHandSize) {
      const discardedCards: string[] = [];
      while (player.hand.length > this.config.maxHandSize) {
        // AI discards the most expensive or unplayable card to return to maxHandSize
        const discarded = player.hand.pop()!;
        player.discard_pile.push(discarded);
        discardedCards.push(discarded.name);
        player.telemetry.discardedCardFromHandThisTurn = true;
      }
      this.log(player.pid, 'HAND-LIMIT', `AI hand exceeded ${this.config.maxHandSize} cards. Discarded: [${discardedCards.join(', ')}].`);
    }

    if (player.hand.length <= this.config.maxHandSize) {
      this.currentPhase = 'OPERATIONS';
    }

    this.log(player.pid, 'TURN-START', `Turn began for ${player.name} (${player.pid}). [DRAW PHASE] Refreshed cards to Ready (R). Drew: [${drawn.join(', ') || 'None'}]. Hand: ${player.hand.length}/${this.config.maxHandSize}. Transitioning to [${this.currentPhase} PHASE].`);
  }

  endPlayerTurn() {
    this.currentPhase = 'CLEANUP';
    const player = this.getActivePlayer();
    const opponent = this.getOpponent();

    // Check "Observer" mission: no offensive operations this turn
    if (player.telemetry.operationsConductedThisTurn === 0) {
      this.placeMissionTokens(player, 'no_ops', 1);
    }

    // Check "Testing the Waters": 3 different operations in 1 turn
    if (player.telemetry.uniqueOpTypesThisTurn.size >= 3) {
      this.placeMissionTokens(player, 'ops_in_turn', 1);
    }

    // Check "Big Spender": played entire hand in 1 turn
    if (player.hand.length === 0 && player.telemetry.cardsPlayedThisTurn >= 3) {
      this.placeMissionTokens(player, 'empty_hand', 1);
    }

    // Store remaining floating coins round-robin (Rule 2.3.7)
    const storeRes = this.storeRemainingCoins(player);
    if (storeRes.stored > 0 || storeRes.discarded > 0) {
      this.log(player.pid, 'COIN-STORE', `[CLEANUP PHASE] Distributed ${storeRes.stored} coins across cards. Discarded ${storeRes.discarded} overflow coins.`);
    }

    if (this.gameOver) return;

    // Check sudden death points threshold
    if (this.config.pointsToWin > 0 && player.mission_points >= this.config.pointsToWin) {
      this.declareWinner(player, `Reached victory threshold of ${this.config.pointsToWin} mission points.`);
      return;
    }

    // Next turn or next round
    if (this.activePlayerIndex === 0) {
      this.startPlayerTurn(1);
    } else {
      if (this.currentRound >= this.config.rounds) {
        this.evaluateEndgame();
      } else {
        this.startRound(this.currentRound + 1);
      }
    }
  }

  evaluateEndgame() {
    this.gameOver = true;
    const [p1, p2] = this.players;
    if (p1.mission_points > p2.mission_points) {
      this.winner = p1;
      this.winReason = `Higher mission points (${p1.mission_points} vs ${p2.mission_points}) at end of Round ${this.config.rounds}.`;
    } else if (p2.mission_points > p1.mission_points) {
      this.winner = p2;
      this.winReason = `Higher mission points (${p2.mission_points} vs ${p1.mission_points}) at end of Round ${this.config.rounds}.`;
    } else {
      // Tie breaker: Total coin wealth
      const p1Coins = this.getTotalSpendableCoins(p1);
      const p2Coins = this.getTotalSpendableCoins(p2);
      if (p1Coins > p2Coins) {
        this.winner = p1;
        this.winReason = `Tied on points (${p1.mission_points}), won by coin wealth (${p1Coins} vs ${p2Coins} coins).`;
      } else if (p2Coins > p1Coins) {
        this.winner = p2;
        this.winReason = `Tied on points (${p2.mission_points}), won by coin wealth (${p2Coins} vs ${p1Coins} coins).`;
      } else {
        this.winner = null;
        this.winReason = `Match tied with ${p1.mission_points} points and ${p1Coins} coins each.`;
      }
    }
    this.log('P1', 'GAME-OVER', `Final outcome: ${this.winReason}`);
  }

  declareWinner(player: Player, reason: string) {
    this.gameOver = true;
    this.winner = player;
    this.winReason = reason;
    this.log(player.pid, 'VICTORY', `★ ${player.name} wins! Reason: ${reason}`);
  }

  getActivePlayer(): Player {
    return this.players[this.activePlayerIndex];
  }

  getOpponent(): Player {
    return this.players[(this.activePlayerIndex + 1) % 2];
  }

  placeMissionTokens(player: Player, eventType: string, amount: number = 1): boolean {
    for (let i = this.missionsOnTable.length - 1; i >= 0; i--) {
      const mission = this.missionsOnTable[i];
      if (mission.type === eventType) {
        mission.tokens[player.pid] = (mission.tokens[player.pid] || 0) + amount;
        const current = mission.tokens[player.pid];
        this.log(player.pid, 'MISSION-TOKEN', `+${amount} token(s) on '${mission.name}' (${current}/${mission.req}).`);

        if (current >= mission.req) {
          player.completed_missions.push(mission);
          player.mission_points += mission.points;
          this.missionsOnTable.splice(i, 1);
          this.log(player.pid, 'MISSION-CLAIM', `★ WON '${mission.name}' (+${mission.points} pts)!`);

          if (this.config.pointsToWin > 0 && player.mission_points >= this.config.pointsToWin) {
            this.declareWinner(player, `Reached ${player.mission_points} mission points.`);
            return true;
          }
        }
      }
    }
    return false;
  }

  // ==========================================
  // VALIDATION & LEGAL ACTION GENERATION
  // ==========================================
  canPlayGlobalDominionPlan(player: Player): boolean {
    // Strict validation of the 3 win conditions:
    // 1. Eliminated another player's operative this turn
    // 2. Raided for at least 4 resources this turn
    // 3. Discarded a card from hand this turn
    const c1 = player.telemetry.eliminatedEnemyOpThisTurn;
    const c2 = player.telemetry.raidedCoinsThisTurn >= 4;
    const c3 = player.telemetry.discardedCardFromHandThisTurn;
    const canAfford = this.getTotalSpendableCoins(player) >= 8;
    return c1 && c2 && c3 && canAfford;
  }

  getLegalActions(player: Player, opponent: Player, selectedCard?: Card | null): Action[] {
    const actions: Action[] = [];
    if (this.gameOver) return actions;

    // Rule 2.2: DRAW Phase hand limit constraint (maximum 5 cards)
    if (this.currentPhase === 'DRAW' && player.hand.length > 5) {
      const cardsToConsider = selectedCard ? [selectedCard] : player.hand;
      for (const card of cardsToConsider) {
        if (player.hand.some(c => c.id === card.id)) {
          actions.push({
            type: 'DISCARD_CARD',
            cardId: card.id,
            cardName: card.name,
            card,
            desc: `Discard ${card.name} to Discard Pile (Hand Limit: ${player.hand.length}/5)`
          });
        }
      }
      return actions;
    }

    if (this.currentPhase === 'DRAW') {
      this.currentPhase = 'OPERATIONS';
    }

    const spendable = this.getTotalSpendableCoins(player);
    const readyOps = player.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
    const enemyOps = opponent.battlefield.filter(c => c.type === 'Operative');
    const enemyLocsWithCoins = opponent.battlefield.filter(c => c.type === 'Location' && (c.stored_coins || 0) > 0);
    const raidTargets: Card[] = [];
    if (opponent.affiliation && (opponent.affiliation.stored_coins || 0) > 0) {
      raidTargets.push(opponent.affiliation);
    }
    raidTargets.push(...enemyLocsWithCoins);

    // Section 3: When a specific card is clicked, display actions available ONLY for that card + 'End Turn' (Pass)
    if (selectedCard) {
      // 3.1.1: Cards in Hand
      const isInHand = player.hand.some(c => c.id === selectedCard.id);
      if (isInHand) {
        // Hand limit rule (Rule 2.2): If hand > maxHandSize cards, allow discarding
        if (player.hand.length > this.config.maxHandSize) {
          actions.push({
            type: 'DISCARD_CARD',
            cardId: selectedCard.id,
            cardName: selectedCard.name,
            card: selectedCard,
            desc: `Discard ${selectedCard.name} to Discard Pile (Hand Limit: ${player.hand.length}/${this.config.maxHandSize})`
          });
        }

        // Deploy action
        let cost = selectedCard.cost;
        if (player.affiliation?.specialAbility === 'play_operative' && selectedCard.type === 'Operative') {
          cost = Math.max(0, cost - 1);
        }

        if (cost <= spendable) {
          if (selectedCard.name === 'Global Dominion Plan') {
            if (this.canPlayGlobalDominionPlan(player)) {
              actions.push({
                type: 'PLAY_CARD',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                desc: `Deploy Global Dominion Plan (Cost: 8) -> WIN GAME!`
              });
            }
          } else if (selectedCard.type === 'Support') {
            if (this.isSupportPlayable(selectedCard.name, player, opponent)) {
              actions.push({
                type: 'PLAY_CARD',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                desc: `Cast ${selectedCard.name} (Cost: ${cost})`
              });
            }
          } else {
            actions.push({
              type: 'PLAY_CARD',
              cardId: selectedCard.id,
              cardName: selectedCard.name,
              card: selectedCard,
              desc: `Deploy ${selectedCard.name} (Cost: ${cost})`
            });
          }
        }

        actions.push({
          type: 'PASS',
          desc: 'Pass / End Turn'
        });
        return actions;
      }

      // 3.1.2: Affiliation Card in play
      if (player.affiliation && player.affiliation.id === selectedCard.id) {
        if (!player.affiliation.exhausted) {
          // (1) Exhaust to produce coins
          actions.push({
            type: 'TAP_PROD',
            cardId: player.affiliation.id,
            cardName: player.affiliation.name,
            card: player.affiliation,
            desc: `Exhaust ${player.affiliation.name} to produce +${player.affiliation.production} coins`
          });

          // (2) Exhaust to activate special ability
          if (player.affiliation.specialAbility === 'spawn_token') {
            actions.push({
              type: 'TAP_ABILITY',
              cardId: player.affiliation.id,
              cardName: player.affiliation.name,
              card: player.affiliation,
              desc: 'Exhaust Shadow Home to spawn 1/1 Shadow Warrior token'
            });
          } else if (player.affiliation.specialAbility === 'draw') {
            actions.push({
              type: 'TAP_ABILITY',
              cardId: player.affiliation.id,
              cardName: player.affiliation.name,
              card: player.affiliation,
              desc: 'Exhaust IMF to draw 1 card'
            });
          }
        }
        actions.push({
          type: 'PASS',
          desc: 'Pass / End Turn'
        });
        return actions;
      }

      // 3.1.3: Location Card in play
      const isLoc = player.battlefield.some(c => c.id === selectedCard.id && c.type === 'Location');
      if (isLoc) {
        if (!selectedCard.exhausted) {
          // (1) Exhaust to produce coins
          actions.push({
            type: 'TAP_PROD',
            cardId: selectedCard.id,
            cardName: selectedCard.name,
            card: selectedCard,
            desc: `Exhaust ${selectedCard.name} to produce +${selectedCard.production} coins`
          });

          // (2) Exhaust to activate special ability
          if (selectedCard.specialAbility === 'armory_buff') {
            const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
            for (const op of friendlyOps) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                targetId: op.id,
                targetName: op.name,
                targetCard: op,
                subChoice: 'buff_off',
                desc: `Exhaust Armory: Give ${op.name} +1 Offense`
              });
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                targetId: op.id,
                targetName: op.name,
                targetCard: op,
                subChoice: 'buff_def',
                desc: `Exhaust Armory: Give ${op.name} +1 Defense`
              });
            }
          } else if (selectedCard.specialAbility === 'troll_farm' || selectedCard.specialAbility === 'force_discard') {
            if (opponent.hand.length > 0) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                desc: `Exhaust Troll Farm: Force ${opponent.name} to discard a card`
              });
            }
          } else if (selectedCard.specialAbility === 'draw_card') {
            actions.push({
              type: 'TAP_ABILITY',
              cardId: selectedCard.id,
              cardName: selectedCard.name,
              card: selectedCard,
              desc: `Exhaust Research Facility: Draw 1 card`
            });
          }
        }
        actions.push({
          type: 'PASS',
          desc: 'Pass / End Turn'
        });
        return actions;
      }

      // 3.1.4: Operative Card in play
      const isOp = player.battlefield.some(c => c.id === selectedCard.id && c.type === 'Operative');
      if (isOp) {
        if (!selectedCard.exhausted) {
          const op = selectedCard;
          const otherReadyOps = readyOps.filter(o => o.id !== op.id);

          // (1) Assassination Operations
          for (const target of enemyOps) {
            const soloOff = (op.off || 1) + (op.ass || 0) + (op.tempOffenseBuff || 0);
            actions.push({
              type: 'OPERATIVE_ACTION',
              cardId: op.id,
              cardName: op.name,
              card: op,
              targetId: target.id,
              targetName: target.name,
              targetCard: target,
              opType: 'ass',
              desc: `Exhaust ${op.name} to Assassinate ${target.name} [Solo OFF: ${soloOff}]`
            });

            if (otherReadyOps.length > 0) {
              let teamOff = 0;
              for (const rop of readyOps) {
                teamOff += (rop.off || 1) + (rop.ass || 0) + (rop.tempOffenseBuff || 0);
              }
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                attackerCards: [...readyOps],
                targetId: target.id,
                targetName: target.name,
                targetCard: target,
                opType: 'ass',
                desc: `Exhaust Team (${readyOps.length} Operatives) to Assassinate ${target.name} [Team OFF: ${teamOff}]`
              });
            }
          }

          // (2) Raid Operations
          for (const target of raidTargets) {
            const soloOff = (op.off || 1) + (op.raid || 0) + (op.tempOffenseBuff || 0);
            actions.push({
              type: 'OPERATIVE_ACTION',
              cardId: op.id,
              cardName: op.name,
              card: op,
              targetId: target.id,
              targetName: target.name,
              targetCard: target,
              opType: 'raid',
              desc: `Exhaust ${op.name} to Raid ${target.name} [Coins: ${target.stored_coins}, Solo OFF: ${soloOff}]`
            });

            if (otherReadyOps.length > 0) {
              let teamOff = 0;
              for (const rop of readyOps) {
                teamOff += (rop.off || 1) + (rop.raid || 0) + (rop.tempOffenseBuff || 0);
              }
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                attackerCards: [...readyOps],
                targetId: target.id,
                targetName: target.name,
                targetCard: target,
                opType: 'raid',
                desc: `Exhaust Team (${readyOps.length} Operatives) to Raid ${target.name} [Team OFF: ${teamOff}]`
              });
            }
          }

          // (3) Subterfuge Operations
          if (opponent.hand.length > 0) {
            const soloOff = (op.off || 1) + (op.sub || 0) + (op.tempOffenseBuff || 0);
            actions.push({
              type: 'OPERATIVE_ACTION',
              cardId: op.id,
              cardName: op.name,
              card: op,
              opType: 'sub',
              desc: `Exhaust ${op.name} for Subterfuge against Hand (${opponent.hand.length} cards) [Solo OFF: ${soloOff}]`
            });

            if (otherReadyOps.length > 0) {
              let teamOff = 0;
              for (const rop of readyOps) {
                teamOff += (rop.off || 1) + (rop.sub || 0) + (rop.tempOffenseBuff || 0);
              }
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                attackerCards: [...readyOps],
                opType: 'sub',
                desc: `Exhaust Team (${readyOps.length} Operatives) for Subterfuge against Hand [Team OFF: ${teamOff}]`
              });
            }
          }

          // (4) Special Abilities
          if (op.specialAbility === 'boksoon_discard_ass1') {
            const eligible = enemyOps.filter(e => (e.ass || 0) >= 1);
            for (const target of eligible) {
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                targetId: target.id,
                targetName: target.name,
                targetCard: target,
                opType: 'boksoon_ass',
                desc: `Boksoon Execution: Discard ${target.name} (Assassin skill >= 1)`
              });
            }
          }
          if (op.specialAbility === 'mata_hari_steal_card' && opponent.hand.length > 0) {
            actions.push({
              type: 'OPERATIVE_ACTION',
              cardId: op.id,
              cardName: op.name,
              card: op,
              opType: 'mata_hari_steal',
              desc: `Mata Hari Charm: Steal card from ${opponent.name}'s hand`
            });
          }
          if (op.specialAbility === 'ghost_siphon_2' && this.getTotalSpendableCoins(opponent) > 0) {
            actions.push({
              type: 'OPERATIVE_ACTION',
              cardId: op.id,
              cardName: op.name,
              card: op,
              opType: 'ghost_siphon',
              desc: `Ghost Cyber-Siphon: Steal 2 resources from ${opponent.name}`
            });
          }
          if (op.specialAbility === 'dan_weak_sacrifice') {
            if (opponent.hand.length > 0) {
              actions.push({
                type: 'DAN_WEAK_SACRIFICE',
                cardId: op.id,
                cardName: op.name,
                card: op,
                subChoice: 'discard_hand',
                desc: `Sacrifice Dan Weak: Force ${opponent.name} to discard entire hand`
              });
            }
            if (opponent.battlefield.length >= 1) {
              actions.push({
                type: 'DAN_WEAK_SACRIFICE',
                cardId: op.id,
                cardName: op.name,
                card: op,
                subChoice: 'discard_in_play',
                desc: `Sacrifice Dan Weak: Force ${opponent.name} to discard 2 cards in play`
              });
            }
          }
        }
        actions.push({
          type: 'PASS',
          desc: 'Pass / End Turn'
        });
        return actions;
      }
    }

    // Default / AI path (selectedCard is null/undefined): Full legal action set
    if (player.hand.length > this.config.maxHandSize) {
      for (const card of player.hand) {
        actions.push({
          type: 'DISCARD_CARD',
          cardId: card.id,
          cardName: card.name,
          card,
          desc: `Discard ${card.name} (Hand Limit: ${player.hand.length}/${this.config.maxHandSize})`
        });
      }
    }

    // 1. Affiliation
    if (player.affiliation && !player.affiliation.exhausted) {
      actions.push({
        type: 'TAP_PROD',
        cardId: player.affiliation.id,
        cardName: player.affiliation.name,
        card: player.affiliation,
        desc: `Exhaust ${player.affiliation.name} to produce +${player.affiliation.production} coins`
      });

      if (player.affiliation.specialAbility === 'spawn_token') {
        actions.push({
          type: 'TAP_ABILITY',
          cardId: player.affiliation.id,
          cardName: player.affiliation.name,
          card: player.affiliation,
          desc: 'Exhaust Shadow Home to spawn 1/1 Shadow Warrior token'
        });
      } else if (player.affiliation.specialAbility === 'draw') {
        actions.push({
          type: 'TAP_ABILITY',
          cardId: player.affiliation.id,
          cardName: player.affiliation.name,
          card: player.affiliation,
          desc: 'Exhaust IMF to draw 1 card'
        });
      }
    }

    // 2. Locations
    for (const loc of player.battlefield) {
      if (loc.type === 'Location' && !loc.exhausted) {
        actions.push({
          type: 'TAP_PROD',
          cardId: loc.id,
          cardName: loc.name,
          card: loc,
          desc: `Exhaust ${loc.name} to produce +${loc.production} coins`
        });

        if (loc.specialAbility === 'armory_buff') {
          const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
          for (const op of friendlyOps) {
            actions.push({
              type: 'TAP_ABILITY',
              cardId: loc.id,
              cardName: loc.name,
              card: loc,
              targetId: op.id,
              targetName: op.name,
              targetCard: op,
              subChoice: 'buff_off',
              desc: `Exhaust Armory: Give ${op.name} +1 Offense`
            });
            actions.push({
              type: 'TAP_ABILITY',
              cardId: loc.id,
              cardName: loc.name,
              card: loc,
              targetId: op.id,
              targetName: op.name,
              targetCard: op,
              subChoice: 'buff_def',
              desc: `Exhaust Armory: Give ${op.name} +1 Defense`
            });
          }
        } else if (loc.specialAbility === 'troll_farm' || loc.specialAbility === 'force_discard') {
          if (opponent.hand.length > 0) {
            actions.push({
              type: 'TAP_ABILITY',
              cardId: loc.id,
              cardName: loc.name,
              card: loc,
              desc: `Exhaust Troll Farm: Force ${opponent.name} to discard a card`
            });
          }
        } else if (loc.specialAbility === 'draw_card') {
          actions.push({
            type: 'TAP_ABILITY',
            cardId: loc.id,
            cardName: loc.name,
            card: loc,
            desc: `Exhaust Research Facility: Draw 1 card`
          });
        }
      }
    }

    // 3. Play Cards from Hand
    for (const card of player.hand) {
      let cost = card.cost;
      if (player.affiliation?.specialAbility === 'play_operative' && card.type === 'Operative') {
        cost = Math.max(0, cost - 1);
      }

      if (cost <= spendable) {
        if (card.name === 'Global Dominion Plan') {
          if (this.canPlayGlobalDominionPlan(player)) {
            actions.push({
              type: 'PLAY_CARD',
              cardId: card.id,
              cardName: card.name,
              card,
              desc: `Deploy Global Dominion Plan (Cost: 8) -> WIN GAME!`
            });
          }
        } else if (card.type === 'Support') {
          if (this.isSupportPlayable(card.name, player, opponent)) {
            actions.push({
              type: 'PLAY_CARD',
              cardId: card.id,
              cardName: card.name,
              card,
              desc: `Cast ${card.name} (Cost: ${cost})`
            });
          }
        } else {
          actions.push({
            type: 'PLAY_CARD',
            cardId: card.id,
            cardName: card.name,
            card,
            desc: `Deploy ${card.name} (Cost: ${cost})`
          });
        }
      }
    }

    // 4. Operative Operations
    for (const op of readyOps) {
      const otherReadyOps = readyOps.filter(o => o.id !== op.id);

      // 4a. Boksoon Execution
      if (op.specialAbility === 'boksoon_discard_ass1') {
        const eligibleTargets = enemyOps.filter(e => (e.ass || 0) >= 1);
        for (const target of eligibleTargets) {
          actions.push({
            type: 'OPERATIVE_ACTION',
            cardId: op.id,
            cardName: op.name,
            card: op,
            targetId: target.id,
            targetName: target.name,
            targetCard: target,
            opType: 'boksoon_ass',
            desc: `Boksoon Execution: Discard ${target.name} (Assassin skill >= 1)`
          });
        }
      }

      // 4b. Mata Hari Charm
      if (op.specialAbility === 'mata_hari_steal_card' && opponent.hand.length > 0) {
        actions.push({
          type: 'OPERATIVE_ACTION',
          cardId: op.id,
          cardName: op.name,
          card: op,
          opType: 'mata_hari_steal',
          desc: `Mata Hari Charm: Steal card from ${opponent.name}'s hand`
        });
      }

      // 4c. Ghost Siphon
      if (op.specialAbility === 'ghost_siphon_2' && this.getTotalSpendableCoins(opponent) > 0) {
        actions.push({
          type: 'OPERATIVE_ACTION',
          cardId: op.id,
          cardName: op.name,
          card: op,
          opType: 'ghost_siphon',
          desc: `Ghost Siphon: Steal 2 resources from ${opponent.name}`
        });
      }

      // 4d. Dan Weak Sacrifice
      if (op.specialAbility === 'dan_weak_sacrifice') {
        if (opponent.hand.length > 0) {
          actions.push({
            type: 'DAN_WEAK_SACRIFICE',
            cardId: op.id,
            cardName: op.name,
            card: op,
            subChoice: 'discard_hand',
            desc: `Sacrifice Dan Weak: Force ${opponent.name} to discard entire hand`
          });
        }
        if (opponent.battlefield.length >= 1) {
          actions.push({
            type: 'DAN_WEAK_SACRIFICE',
            cardId: op.id,
            cardName: op.name,
            card: op,
            subChoice: 'discard_in_play',
            desc: `Sacrifice Dan Weak: Force ${opponent.name} to discard 2 cards in play`
          });
        }
      }

      // 4e. Assassinate (Solo & Team)
      for (const target of enemyOps) {
        const soloOff = (op.off || 1) + (op.ass || 0) + (op.tempOffenseBuff || 0);
        actions.push({
          type: 'OPERATIVE_ACTION',
          cardId: op.id,
          cardName: op.name,
          card: op,
          targetId: target.id,
          targetName: target.name,
          targetCard: target,
          opType: 'ass',
          desc: `Exhaust ${op.name} to Assassinate ${target.name} [Solo OFF: ${soloOff}]`
        });

        if (otherReadyOps.length > 0) {
          let teamOff = 0;
          for (const rop of readyOps) {
            teamOff += (rop.off || 1) + (rop.ass || 0) + (rop.tempOffenseBuff || 0);
          }
          actions.push({
            type: 'OPERATIVE_ACTION',
            cardId: op.id,
            cardName: op.name,
            card: op,
            attackerCards: [...readyOps],
            targetId: target.id,
            targetName: target.name,
            targetCard: target,
            opType: 'ass',
            desc: `Exhaust Team (${readyOps.length} Operatives) to Assassinate ${target.name} [Team OFF: ${teamOff}]`
          });
        }
      }

      // 4f. Raid (Solo & Team)
      for (const target of raidTargets) {
        const soloOff = (op.off || 1) + (op.raid || 0) + (op.tempOffenseBuff || 0);
        actions.push({
          type: 'OPERATIVE_ACTION',
          cardId: op.id,
          cardName: op.name,
          card: op,
          targetId: target.id,
          targetName: target.name,
          targetCard: target,
          opType: 'raid',
          desc: `Exhaust ${op.name} to Raid ${target.name} [Coins: ${target.stored_coins}, Solo OFF: ${soloOff}]`
        });

        if (otherReadyOps.length > 0) {
          let teamOff = 0;
          for (const rop of readyOps) {
            teamOff += (rop.off || 1) + (rop.raid || 0) + (rop.tempOffenseBuff || 0);
          }
          actions.push({
            type: 'OPERATIVE_ACTION',
            cardId: op.id,
            cardName: op.name,
            card: op,
            attackerCards: [...readyOps],
            targetId: target.id,
            targetName: target.name,
            targetCard: target,
            opType: 'raid',
            desc: `Exhaust Team (${readyOps.length} Operatives) to Raid ${target.name} [Team OFF: ${teamOff}]`
          });
        }
      }

      // 4g. Subterfuge (Solo & Team)
      if (opponent.hand.length > 0) {
        const soloOff = (op.off || 1) + (op.sub || 0) + (op.tempOffenseBuff || 0);
        actions.push({
          type: 'OPERATIVE_ACTION',
          cardId: op.id,
          cardName: op.name,
          card: op,
          opType: 'sub',
          desc: `Exhaust ${op.name} for Subterfuge against Hand [Solo OFF: ${soloOff}]`
        });

        if (otherReadyOps.length > 0) {
          let teamOff = 0;
          for (const rop of readyOps) {
            teamOff += (rop.off || 1) + (rop.sub || 0) + (rop.tempOffenseBuff || 0);
          }
          actions.push({
            type: 'OPERATIVE_ACTION',
            cardId: op.id,
            cardName: op.name,
            card: op,
            attackerCards: [...readyOps],
            opType: 'sub',
            desc: `Exhaust Team (${readyOps.length} Operatives) for Subterfuge against Hand [Team OFF: ${teamOff}]`
          });
        }
      }
    }

    // 5. Pass Turn
    actions.push({
      type: 'PASS',
      desc: 'Pass / End Turn'
    });

    return actions;
  }

  isSupportPlayable(cardName: string, player: Player, opponent: Player): boolean {
    const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
    const enemyOps = opponent.battlefield.filter(c => c.type === 'Operative');
    const enemyLocs = opponent.battlefield.filter(c => c.type === 'Location');

    if (['Assassination Training', 'Raid Training', 'Subterfuge Training'].includes(cardName)) {
      return friendlyOps.length > 0;
    }
    if (cardName === 'Operative Crew') return friendlyOps.length > 0 && enemyOps.length > 0;
    if (['Double Agent', 'Targeted for Whitewash'].includes(cardName)) return enemyOps.length > 0;
    if (cardName === 'Acquisition') return enemyLocs.length > 0;
    if (cardName === 'Hiring Hackers') return this.getTotalSpendableCoins(opponent) > 0;
    if (cardName === 'Hired Subterfuge') return opponent.hand.length > 0;
    if (cardName === 'Global Dominion Plan') return this.canPlayGlobalDominionPlan(player);
    return true;
  }

  // ==========================================
  // ACTION EXECUTION & DEFENSIVE INTERCEPTS
  // ==========================================
  executeAction(
    player: Player,
    opponent: Player,
    action: Action,
    defenderCardIds?: string[]
  ): { success: boolean; thwarted?: boolean; message: string; defendersUsed?: Card[]; totalDef?: number } {
    if (action.type === 'PASS') {
      this.endPlayerTurn();
      return { success: true, message: 'Operations concluded. Turn ended.' };
    }

    if (action.type === 'ADVANCE_PHASE') {
      if (this.currentPhase === 'DRAW') {
        this.currentPhase = 'OPERATIONS';
        this.log(player.pid, 'PHASE', `Transitioned from DRAW to OPERATIONS Phase.`);
        return { success: true, message: 'Advanced to Operations Phase.' };
      }
      return { success: true, message: 'Phase unchanged.' };
    }

    if (action.type === 'DISCARD_CARD') {
      const card = action.card!;
      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.discard_pile.push(card);
        player.telemetry.discardedCardFromHandThisTurn = true;
        this.log(player.pid, 'DISCARD', `Discarded '${card.name}' from hand to discard pile.`);
        if (player.hand.length <= 5 && this.currentPhase === 'DRAW') {
          this.currentPhase = 'OPERATIONS';
          this.log(player.pid, 'PHASE', `Hand size within limit (5). Transitioned to OPERATIONS Phase.`);
        }
        return { success: true, message: `Discarded ${card.name}.` };
      }
      return { success: false, message: 'Card not found in hand.' };
    }

    if (action.type === 'TAP_PROD') {
      const card = action.card!;
      card.exhausted = true;
      const prod = card.production || 1;
      player.current_turn_coins += prod;
      this.log(player.pid, 'PRODUCE', `Tapped ${card.name} for +${prod} coins.`);
      return { success: true, message: `Produced +${prod} coins.` };
    }

    if (action.type === 'TAP_ABILITY') {
      const card = action.card!;
      card.exhausted = true;

      if (card.specialAbility === 'spawn_token') {
        const tokenExh = this.config.operativeSummonState === 'E';
        const token: Card = {
          id: `token_shadow_${Date.now()}`,
          name: 'Shadow Warrior Token',
          type: 'Operative',
          cost: 0,
          off: 1,
          def: 1,
          ass: 1,
          raid: 0,
          sub: 0,
          isToken: true,
          exhausted: tokenExh
        };
        player.battlefield.push(token);
        this.log(player.pid, 'AFF-ABILITY', `Shadow Home spawned 1/1 Shadow Warrior Token ${tokenExh ? '(E)' : '(R)'}.`);
        return { success: true, message: 'Spawned Shadow Warrior Token.' };
      }

      if (card.specialAbility === 'draw' || card.specialAbility === 'draw_card') {
        if (this.drawDeck.length > 0 && player.hand.length < this.config.maxHandSize) {
          const drawn = this.drawDeck.pop()!;
          player.hand.push(drawn);
          this.log(player.pid, 'LOC-ABILITY', `${card.name} tapped: Drew '${drawn.name}'.`);
          return { success: true, message: `Drew ${drawn.name}.` };
        }
      }

      if (card.specialAbility === 'armory_buff') {
        const target = action.targetCard!;
        if (action.subChoice === 'buff_off') {
          target.tempOffenseBuff = (target.tempOffenseBuff || 0) + 1;
          this.log(player.pid, 'LOC-ABILITY', `Armory granted +1 Offense to ${target.name}.`);
          return { success: true, message: `Granted +1 Offense to ${target.name}.` };
        } else {
          target.tempDefenseBuff = (target.tempDefenseBuff || 0) + 1;
          this.log(player.pid, 'LOC-ABILITY', `Armory granted +1 Defense to ${target.name}.`);
          return { success: true, message: `Granted +1 Defense to ${target.name}.` };
        }
      }

      if (card.specialAbility === 'force_discard' || card.specialAbility === 'troll_farm') {
        if (opponent.hand.length > 0) {
          const dropped = opponent.hand.pop()!;
          opponent.discard_pile.push(dropped);
          opponent.telemetry.discardedCardFromHandThisTurn = true;
          this.log(player.pid, 'LOC-ABILITY', `Troll Farm forced ${opponent.name} to discard '${dropped.name}'.`);
          if (opponent.hand.length === 0) {
            this.placeMissionTokens(player, 'hand_wipe', 1);
          }
          return { success: true, message: `Forced ${opponent.name} to discard ${dropped.name}.` };
        }
      }
    }

    if (action.type === 'PLAY_CARD') {
      const card = action.card!;
      let cost = card.cost;
      if (player.affiliation?.specialAbility === 'play_operative' && card.type === 'Operative') {
        cost = Math.max(0, cost - 1);
      }

      if (!this.spendCoins(player, cost)) {
        return { success: false, message: 'Not enough coins to play card.' };
      }

      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx !== -1) player.hand.splice(idx, 1);

      player.telemetry.cardsPlayedThisTurn++;

      if (card.isNamed) {
        player.telemetry.playedNamedThisTurn = true;
        this.placeMissionTokens(player, 'play_named', 1);
      }

      if (card.name === 'Global Dominion Plan') {
        player.discard_pile.push(card);
        this.log(player.pid, 'GLOBAL-DOMINION', `⚡ GLOBAL DOMINION PLAN ENACTED! All 3 victory requirements fulfilled!`);
        this.declareWinner(player, `Global Dominion Plan executed successfully!`);
        return { success: true, message: 'Global Dominion Plan won the game!' };
      }

      if (card.type === 'Location') {
        const locExh = this.config.locationSummonState === 'E';
        const inst: Card = { ...card, stored_coins: 0, exhausted: locExh };
        player.battlefield.push(inst);
        this.log(player.pid, 'PLAY-LOC', `Deployed Location: ${card.name} (Cost: ${cost}) ${locExh ? '(E)' : '(R)'}.`);
        return { success: true, message: `Deployed ${card.name}.` };
      }

      if (card.type === 'Operative') {
        const opExh = this.config.operativeSummonState === 'E';
        const inst: Card = { ...card, exhausted: opExh };
        player.battlefield.push(inst);
        this.log(player.pid, 'PLAY-OP', `Deployed Operative: ${card.name} (Cost: ${cost}) [Off:${card.off}/Def:${card.def}] ${opExh ? '(E)' : '(R)'}.`);

        // Ghost: Siphons 2 resources upon deployment
        if (card.name === 'Ghost') {
          const stolen = Math.min(this.getTotalSpendableCoins(opponent), 2);
          if (stolen > 0) {
            this.spendCoins(opponent, stolen);
            player.current_turn_coins += stolen;
            player.telemetry.raidedCoinsThisTurn += stolen;
            this.log(player.pid, 'GHOST-SIPHON', `Ghost triggered deployment siphon! Stole ${stolen} resources from ${opponent.name}.`);
            this.placeMissionTokens(player, 'res_theft', stolen);
          }
        }
        return { success: true, message: `Deployed ${card.name}.` };
      }

      if (card.type === 'Support') {
        player.discard_pile.push(card);
        this.log(player.pid, 'CAST-SUPPORT', `Cast Support: ${card.name} (Cost: ${cost}).`);
        this.resolveSupportSpell(player, opponent, card.name);
        return { success: true, message: `Cast ${card.name}.` };
      }
    }

    if (action.type === 'DAN_WEAK_SACRIFICE') {
      const op = action.card!;
      const threatType = action.subChoice === 'discard_hand' ? 'sub' : 'ass';
      const incomingAttack = (op.off || 4) + (threatType === 'ass' ? (op.ass || 2) : (op.sub || 2)); // 6
      const defRes = this.resolveDefense(opponent, threatType, incomingAttack, defenderCardIds || action.defenderCardIds);

      // Dan Weak is sacrificed from play regardless
      const idx = player.battlefield.findIndex(c => c.id === op.id);
      if (idx !== -1) {
        player.battlefield.splice(idx, 1);
        player.discard_pile.push(op);
      }

      if (defRes.thwarted) {
        this.log(opponent.pid, threatType === 'ass' ? 'THWART-ASS' : 'THWART-SUB', `🛡️ DEFENSIVE TEAM! ${defRes.message} teamed up against Dan Weak's Attack (ATK: ${incomingAttack})! Attack THWARTED!`);
        this.placeMissionTokens(opponent, threatType === 'ass' ? 'thwart_ass' : 'thwart_sub', 1);
        return { success: true, thwarted: true, message: `Dan Weak attack thwarted by ${defRes.message}!`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
      }

      if (action.subChoice === 'discard_hand') {
        const effectiveSub = Math.max(0, incomingAttack - defRes.totalDef);
        const count = Math.min(opponent.hand.length, effectiveSub);
        const dropped: string[] = [];
        for (let i = 0; i < count; i++) {
          if (opponent.hand.length > 0) {
            const d = opponent.hand.pop()!;
            opponent.discard_pile.push(d);
            dropped.push(d.name);
            opponent.telemetry.discardedCardFromHandThisTurn = true;
          }
        }
        if (defRes.defenders.length > 0) {
          this.log(player.pid, 'DAN-WEAK-SACRIFICE', `Sacrificed Dan Weak! Defenders (DEF: ${defRes.totalDef}) reduced impact, but forced ${opponent.name} to discard ${count} cards: [${dropped.join(', ')}].`);
        } else {
          this.log(player.pid, 'DAN-WEAK-SACRIFICE', `Sacrificed Dan Weak! Forced ${opponent.name} to discard hand (${count} cards: [${dropped.join(', ')}]).`);
        }
        if (opponent.hand.length === 0 && count > 0) {
          this.placeMissionTokens(player, 'hand_wipe', 1);
        }
        return { success: true, message: `Dan Weak wiped ${opponent.name}'s hand.`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
      } else {
        // Discard 2 in-play cards
        const removed: string[] = [];
        for (let i = 0; i < 2; i++) {
          if (opponent.battlefield.length > 0) {
            const discarded = opponent.battlefield.pop()!;
            opponent.discard_pile.push(discarded);
            removed.push(discarded.name);
            if (discarded.type === 'Operative') {
              player.telemetry.eliminatedEnemyOpThisTurn = true;
              this.placeMissionTokens(player, 'kills', 1);
            }
          }
        }
        this.log(player.pid, 'DAN-WEAK-SACRIFICE', `Sacrificed Dan Weak! Discarded 2 cards from ${opponent.name}'s battlefield: [${removed.join(', ')}].`);
        return { success: true, message: `Dan Weak eliminated 2 cards: ${removed.join(', ')}.`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
      }
    }

    if (action.type === 'OPERATIVE_ACTION') {
      const op = action.card!;
      const attackers = (action.attackerCards && action.attackerCards.length > 0) ? action.attackerCards : [op];
      for (const a of attackers) {
        a.exhausted = true;
      }
      player.telemetry.operationsConductedThisTurn++;

      // 1. Boksoon Specialized Ability: Discard enemy operative with Assassin >= 1
      if (action.opType === 'boksoon_ass') {
        const target = action.targetCard!;
        const atk = (op.off || 4) + (op.ass || 3); // Boksoon ATK = 7
        const defRes = this.resolveDefense(opponent, 'ass', atk, defenderCardIds || action.defenderCardIds);

        if (defRes.thwarted) {
          this.log(opponent.pid, 'THWART-ASS', `🛡️ DEFENSIVE TEAM! ${defRes.message} stepped in to thwart Boksoon's strike (ATK: ${atk})! Attack negated!`);
          this.placeMissionTokens(opponent, 'thwart_ass', 1);
          return { success: true, thwarted: true, message: `Boksoon strike thwarted by ${defRes.message}!`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
        }

        const tIdx = opponent.battlefield.findIndex(c => c.id === target.id);
        if (tIdx !== -1) {
          opponent.battlefield.splice(tIdx, 1);
          opponent.discard_pile.push(target);
          player.telemetry.eliminatedEnemyOpThisTurn = true;
          this.log(player.pid, 'BOKSOON-EXECUTE', `Boksoon executed targeted assassination on ${target.name} (Assassin skill >= 1). Target destroyed!`);
          this.placeMissionTokens(player, 'kills', 1);
          return { success: true, message: `Boksoon executed ${target.name}.`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
        }
      }

      // 2. Mata Hari Specialized Ability: Steal random card from enemy hand
      if (action.opType === 'mata_hari_steal') {
        const atk = (op.off || 3) + (op.sub || 3); // Mata Hari ATK = 6
        const defRes = this.resolveDefense(opponent, 'sub', atk, defenderCardIds || action.defenderCardIds);

        if (defRes.thwarted) {
          this.log(opponent.pid, 'THWART-SUB', `🛡️ DEFENSIVE TEAM! ${defRes.message} intercepted Mata Hari's infiltration (ATK: ${atk})! Attack neutralized!`);
          this.placeMissionTokens(opponent, 'thwart_sub', 1);
          return { success: true, thwarted: true, message: `Mata Hari infiltration thwarted by ${defRes.message}!`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
        }

        if (opponent.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * opponent.hand.length);
          const [stolen] = opponent.hand.splice(randIdx, 1);
          player.hand.push(stolen);
          player.telemetry.uniqueOpTypesThisTurn.add('sub');
          this.log(player.pid, 'MATA-HARI-STEAL', `Mata Hari stole '${stolen.name}' directly from ${opponent.name}'s hand into your hand!`);
          if (opponent.hand.length === 0) {
            this.placeMissionTokens(player, 'hand_wipe', 1);
          }
          return { success: true, message: `Stole ${stolen.name} from enemy hand!`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
        }
      }

      // 3. Ghost Specialized Activation: Siphon 2 resources
      if (action.opType === 'ghost_siphon') {
        const atk = (op.off || 3) + (op.raid || 3); // Ghost ATK = 6
        const defRes = this.resolveDefense(opponent, 'raid', atk, defenderCardIds || action.defenderCardIds);

        if (defRes.thwarted) {
          this.log(opponent.pid, 'THWART-RAID', `🛡️ DEFENSIVE TEAM! ${defRes.message} blocked Ghost's siphon exploit (ATK: ${atk})! Zero resources stolen.`);
          this.placeMissionTokens(opponent, 'thwart_raid', 1);
          return { success: true, thwarted: true, message: `Ghost siphon thwarted by ${defRes.message}!`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
        }

        const effectiveRaid = Math.max(1, 2 - defRes.totalDef);
        const stolen = Math.min(this.getTotalSpendableCoins(opponent), effectiveRaid);
        if (stolen > 0) {
          this.spendCoins(opponent, stolen);
          player.current_turn_coins += stolen;
          player.telemetry.raidedCoinsThisTurn += stolen;
          player.telemetry.uniqueOpTypesThisTurn.add('raid');
          this.log(player.pid, 'GHOST-ACTIVATE', `Ghost activated cyber-siphon! Captured ${stolen} resources from ${opponent.name}.`);
          this.placeMissionTokens(player, 'res_theft', stolen);
          return { success: true, message: `Ghost captured ${stolen} resources.`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
        }
      }

      // 4. Standard / Team Assassinate
      if (action.opType === 'ass') {
        player.telemetry.uniqueOpTypesThisTurn.add('ass');
        const target = action.targetCard!;

        let atk = 0;
        for (const a of attackers) {
          atk += (a.off || 1) + (a.ass || 0) + (a.tempOffenseBuff || 0);
        }
        const attackerNames = attackers.map(a => a.name).join(' + ');

        // DEFENSIVE TEAM ASSIGNMENT (Rule 2)
        const defRes = this.resolveDefense(opponent, 'ass', atk, defenderCardIds || action.defenderCardIds);

        // Calculate target's innate defense if target was not already one of the active defending operatives
        const isExh = target.exhausted;
        const targetAlreadyInDefenders = defRes.defenders.some(d => d.id === target.id);
        const targetInnateDef = targetAlreadyInDefenders ? 0 : ((target.def || 1) + (isExh ? 0 : (target.ass || 0)) + (target.tempDefenseBuff || 0));
        const effectiveDef = defRes.totalDef + targetInnateDef;

        // Helper to discard card from player battlefield to discard pile
        const discardFromBattlefield = (p: Player, c: Card) => {
          const idx = p.battlefield.findIndex(item => item.id === c.id);
          if (idx !== -1) {
            p.battlefield.splice(idx, 1);
            p.discard_pile.push(c);
          }
        };

        // ASSASSINATION RESOLUTION RULES:
        // - Attacker > Defender: Assassination successful, Defending cards are discarded.
        // - Attacker == Defender: Assassination successful, both Attacker and Defender cards are discarded.
        // - Attacker < Defender: Assassination Failed, Attacker cards are discarded.
        if (atk > effectiveDef) {
          // Success: Defending cards discarded (target + defending operatives)
          discardFromBattlefield(opponent, target);
          player.telemetry.eliminatedEnemyOpThisTurn = true;
          this.placeMissionTokens(player, 'kills', 1);

          for (const d of defRes.defenders) {
            if (d.id !== target.id) {
              discardFromBattlefield(opponent, d);
              player.telemetry.eliminatedEnemyOpThisTurn = true;
              this.placeMissionTokens(player, 'kills', 1);
            }
          }

          const defDesc = defRes.defenders.length > 0 ? ` and defending team [${defRes.defenders.map(d => d.name).join(', ')}]` : '';
          this.log(player.pid, 'ASSASSINATE-SUCCESS', `💥 ASSASSINATION SUCCESSFUL! ${attackerNames} (ATK: ${atk}) overwhelmed ${target.name} (Total DEF: ${effectiveDef})${defDesc}! Defending cards discarded.`);
          return { success: true, message: `Assassination successful! Target ${target.name}${defDesc} discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        } else if (atk === effectiveDef) {
          // Success with mutual destruction: Both Attacker and Defender cards discarded
          discardFromBattlefield(opponent, target);
          player.telemetry.eliminatedEnemyOpThisTurn = true;
          this.placeMissionTokens(player, 'kills', 1);

          for (const d of defRes.defenders) {
            if (d.id !== target.id) {
              discardFromBattlefield(opponent, d);
              player.telemetry.eliminatedEnemyOpThisTurn = true;
              this.placeMissionTokens(player, 'kills', 1);
            }
          }

          for (const a of attackers) {
            discardFromBattlefield(player, a);
          }

          this.log(player.pid, 'ASSASSINATE-MUTUAL', `⚔️ ASSASSINATION MUTUAL CASUALTIES! ${attackerNames} (ATK: ${atk}) equaled defense (DEF: ${effectiveDef})! Both Attacker and Defender cards were discarded.`);
          return { success: true, message: `Assassination succeeded with mutual destruction. Both sides discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        } else {
          // Failed: Attacker cards discarded
          for (const a of attackers) {
            discardFromBattlefield(player, a);
          }
          this.log(opponent.pid, 'ASSASSINATE-FAILED', `🛡️ ASSASSINATION FAILED! ${target.name} and defense (Total DEF: ${effectiveDef}) repelled ${attackerNames} (ATK: ${atk})! Attacking operative cards discarded.`);
          this.placeMissionTokens(opponent, 'thwart_ass', 1);
          return { success: true, thwarted: true, message: `Assassination failed! Attacking operatives discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        }
      }

      // 5. Standard / Team Raid
      if (action.opType === 'raid') {
        player.telemetry.uniqueOpTypesThisTurn.add('raid');

        let totalRaidOff = 0;
        let totalRaidSkill = 0;
        for (const a of attackers) {
          totalRaidOff += (a.off || 1) + (a.raid || 0) + (a.tempOffenseBuff || 0);
          totalRaidSkill += (a.raid || 0);
        }
        const attackerNames = attackers.map(a => a.name).join(' + ');

        // DEFENSIVE TEAM ASSIGNMENT (Rule 2)
        const defRes = this.resolveDefense(opponent, 'raid', totalRaidOff, defenderCardIds || action.defenderCardIds);
        const effectiveDef = defRes.totalDef;

        const discardFromBattlefield = (p: Player, c: Card) => {
          const idx = p.battlefield.findIndex(item => item.id === c.id);
          if (idx !== -1) {
            p.battlefield.splice(idx, 1);
            p.discard_pile.push(c);
          }
        };

        // RAID RESOLUTION RULES:
        // - Attacker > Defender: Raid is successful.
        //   Rule: 1 coin is taken for every card used in the Operation, plus 1 additional coin for each point of applicable skill (raid skill) in the Operation.
        //   Defending Operatives are discarded.
        // - Attacker == Defender: Raid is Thwarted. All Operative cards (both Attackers and Defenders) are discarded.
        // - Attacker < Defender: Raid is Thwarted, Attacking Operative cards are discarded.
        if (totalRaidOff > effectiveDef) {
          const target = action.targetCard;
          let stolen = 0;
          const maxTake = attackers.length + totalRaidSkill;
          if (target && typeof target.stored_coins === 'number' && target.stored_coins > 0) {
            stolen = Math.min(target.stored_coins, maxTake);
            target.stored_coins -= stolen;
          }

          if (stolen > 0) {
            player.current_turn_coins += stolen;
            player.telemetry.raidedCoinsThisTurn += stolen;
            this.placeMissionTokens(player, 'res_theft', stolen);
          }

          // Defending operatives are discarded
          for (const d of defRes.defenders) {
            discardFromBattlefield(opponent, d);
          }

          const targetName = target ? target.name : 'Target';
          const defDesc = defRes.defenders.length > 0 ? ` Defending operatives [${defRes.defenders.map(d => d.name).join(', ')}] were eliminated and discarded.` : '';
          this.log(player.pid, 'OP-RAID', `💰 RAID SUCCESSFUL! ${attackerNames} (ATK: ${totalRaidOff}) defeated defense (DEF: ${effectiveDef})! Raided ${stolen} coin(s) (${attackers.length} card${attackers.length > 1 ? 's' : ''} used + ${totalRaidSkill} Raid Skill) from ${targetName}.${defDesc}`);
          return { success: true, message: `Raid successful! Stole ${stolen} coin(s) from ${targetName} (${attackers.length} card${attackers.length > 1 ? 's' : ''} + ${totalRaidSkill} skill).${defDesc}`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        } else if (totalRaidOff === effectiveDef) {
          // Thwarted: All Operative cards (attackers + defenders) discarded
          for (const a of attackers) {
            discardFromBattlefield(player, a);
          }
          for (const d of defRes.defenders) {
            discardFromBattlefield(opponent, d);
          }
          this.log(opponent.pid, 'THWART-RAID', `⚖️ RAID THWARTED (TIED)! ${attackerNames} (ATK: ${totalRaidOff}) matched defense (DEF: ${effectiveDef}). All participating operative cards discarded! Zero coins stolen.`);
          this.placeMissionTokens(opponent, 'thwart_raid', 1);
          return { success: true, thwarted: true, message: `Raid thwarted (tied)! All participating operative cards discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        } else {
          // Thwarted: Attacking operative cards discarded
          for (const a of attackers) {
            discardFromBattlefield(player, a);
          }
          this.log(opponent.pid, 'THWART-RAID', `🛡️ RAID THWARTED! ${defRes.message} (DEF: ${effectiveDef}) repelled ${attackerNames} (ATK: ${totalRaidOff})! Attacking operatives discarded.`);
          this.placeMissionTokens(opponent, 'thwart_raid', 1);
          return { success: true, thwarted: true, message: `Raid thwarted! Attacking operatives discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        }
      }

      // 6. Standard / Team Subterfuge
      if (action.opType === 'sub') {
        player.telemetry.uniqueOpTypesThisTurn.add('sub');

        let totalSubOff = 0;
        let totalSubSkill = 0;
        for (const a of attackers) {
          totalSubOff += (a.off || 1) + (a.sub || 0) + (a.tempOffenseBuff || 0);
          totalSubSkill += (a.sub || 0);
        }
        const attackerNames = attackers.map(a => a.name).join(' + ');

        // DEFENSIVE TEAM ASSIGNMENT (Rule 2)
        const defRes = this.resolveDefense(opponent, 'sub', totalSubOff, defenderCardIds || action.defenderCardIds);
        const effectiveDef = defRes.totalDef;

        const discardFromBattlefield = (p: Player, c: Card) => {
          const idx = p.battlefield.findIndex(item => item.id === c.id);
          if (idx !== -1) {
            p.battlefield.splice(idx, 1);
            p.discard_pile.push(c);
          }
        };

        // SUBTERFUGE RESOLUTION RULES:
        // - Attacker > Defender: Subterfuge is successful.
        //   Rule: 1 card is discarded for every card used in the Operation, plus 1 additional card for each point of applicable skill (sub skill) in the Operation.
        //   Defending Operatives are discarded.
        // - Attacker == Defender: Subterfuge is Thwarted. All Operative cards (both Attackers and Defenders) are discarded.
        // - Attacker < Defender: Subterfuge is Thwarted, Attacking Operative cards are discarded.
        if (totalSubOff > effectiveDef) {
          const maxDiscards = attackers.length + totalSubSkill;
          const cardsToDrop = Math.min(opponent.hand.length, maxDiscards);
          const dropped: string[] = [];
          for (let i = 0; i < cardsToDrop; i++) {
            if (opponent.hand.length > 0) {
              const c = opponent.hand.pop()!;
              opponent.discard_pile.push(c);
              dropped.push(c.name);
              opponent.telemetry.discardedCardFromHandThisTurn = true;
            }
          }

          // Defending operatives are discarded
          for (const d of defRes.defenders) {
            discardFromBattlefield(opponent, d);
          }

          if (opponent.hand.length === 0 && dropped.length > 0) {
            this.placeMissionTokens(player, 'hand_wipe', 1);
          }

          const defDesc = defRes.defenders.length > 0 ? ` Defending operatives [${defRes.defenders.map(d => d.name).join(', ')}] were eliminated and discarded.` : '';
          this.log(player.pid, 'OP-SUB', `🕵️ SUBTERFUGE SUCCESSFUL! ${attackerNames} (ATK: ${totalSubOff}) overpowered defense (DEF: ${effectiveDef})! Forced discard of ${dropped.length} card(s) (${attackers.length} card${attackers.length > 1 ? 's' : ''} used + ${totalSubSkill} Sub Skill): [${dropped.join(', ')}].${defDesc}`);
          return { success: true, message: `Subterfuge successful! Forced discard of ${dropped.length} card(s) (${attackers.length} card${attackers.length > 1 ? 's' : ''} + ${totalSubSkill} skill).${defDesc}`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        } else if (totalSubOff === effectiveDef) {
          // Thwarted: All Operative cards discarded
          for (const a of attackers) {
            discardFromBattlefield(player, a);
          }
          for (const d of defRes.defenders) {
            discardFromBattlefield(opponent, d);
          }
          this.log(opponent.pid, 'THWART-SUB', `⚖️ SUBTERFUGE THWARTED (TIED)! ${attackerNames} (ATK: ${totalSubOff}) matched defense (DEF: ${effectiveDef}). All participating operative cards discarded! Zero cards discarded from hand.`);
          this.placeMissionTokens(opponent, 'thwart_sub', 1);
          return { success: true, thwarted: true, message: `Subterfuge thwarted (tied)! All participating operative cards discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        } else {
          // Thwarted: Attacking operative cards discarded
          for (const a of attackers) {
            discardFromBattlefield(player, a);
          }
          this.log(opponent.pid, 'THWART-SUB', `🛡️ SUBTERFUGE THWARTED! ${defRes.message} (DEF: ${effectiveDef}) blocked ${attackerNames} (ATK: ${totalSubOff})! Attacking operatives discarded.`);
          this.placeMissionTokens(opponent, 'thwart_sub', 1);
          return { success: true, thwarted: true, message: `Subterfuge thwarted! Attacking operatives discarded.`, defendersUsed: defRes.defenders, totalDef: effectiveDef };
        }
      }

      if (action.opType === 'hold') {
        this.log(player.pid, 'DEFENSIVE-HOLD', `${op.name} fortified active defensive posture.`);
        return { success: true, message: `${op.name} holding perimeter.` };
      }
    }

    return { success: false, message: 'Action could not be executed.' };
  }

  // ==========================================
  // DEFENSIVE TEAM SYSTEM (Rule 2)
  // Calculates individual operative defense contribution:
  // Base DEF + TempBuff + 1 point for each applicable Skill rating
  // ==========================================
  calculateOperativeDefense(card: Card, threatType: 'ass' | 'sub' | 'raid'): { baseDef: number; tempBuff: number; skillBonus: number; totalDef: number } {
    const baseDef = card.def || 1;
    const tempBuff = card.tempDefenseBuff || 0;
    let skillRating = 0;
    if (threatType === 'ass') skillRating = card.ass || 0;
    else if (threatType === 'sub') skillRating = card.sub || 0;
    else if (threatType === 'raid') skillRating = card.raid || 0;

    const skillBonus = skillRating * 1;
    const totalDef = baseDef + tempBuff + skillBonus;
    return { baseDef, tempBuff, skillBonus, totalDef };
  }

  // AI selects defensive team to block or mitigate incoming attack
  selectAiDefenders(defender: Player, threatType: 'ass' | 'sub' | 'raid', incomingAttack: number): Card[] {
    const readyOps = defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
    if (readyOps.length === 0) return [];

    const rated = readyOps.map(op => ({
      op,
      calc: this.calculateOperativeDefense(op, threatType)
    }));

    // 1. Single blocker that stops the attack
    const singleBlockers = rated.filter(r => r.calc.totalDef >= incomingAttack);
    if (singleBlockers.length > 0) {
      singleBlockers.sort((a, b) => a.calc.totalDef - b.calc.totalDef);
      return [singleBlockers[0].op];
    }

    // 2. Combination of ready operatives that can team up to stop the attack
    rated.sort((a, b) => b.calc.totalDef - a.calc.totalDef);
    let accumulated = 0;
    const team: Card[] = [];
    for (const r of rated) {
      team.push(r.op);
      accumulated += r.calc.totalDef;
      if (accumulated >= incomingAttack) {
        return team;
      }
    }

    // 3. Partial defense: For Raid or Subterfuge, defending operatives absorb damage
    if (threatType === 'raid' || threatType === 'sub') {
      return rated.slice(0, Math.min(2, rated.length)).map(r => r.op);
    }

    // For Assassination, if defense cannot reach incomingAttack, don't exhaust operatives in vain
    return [];
  }

  // Resolves assigned defense against an incoming attack
  resolveDefense(
    defender: Player,
    threatType: 'ass' | 'sub' | 'raid',
    incomingAttack: number,
    defenderCardIds?: string[]
  ): { defenders: Card[]; totalDef: number; thwarted: boolean; message: string } {
    const readyOps = defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
    let assigned: Card[] = [];

    if (Array.isArray(defenderCardIds)) {
      assigned = readyOps.filter(c => defenderCardIds.includes(c.id));
    } else if (defender.isAI) {
      assigned = this.selectAiDefenders(defender, threatType, incomingAttack);
    } else {
      assigned = this.selectAiDefenders(defender, threatType, incomingAttack);
    }

    if (assigned.length === 0) {
      return {
        defenders: [],
        totalDef: 0,
        thwarted: false,
        message: 'No defenders assigned'
      };
    }

    // Exhaust assigned defending operatives
    for (const d of assigned) {
      d.exhausted = true;
    }

    // Total defense values + 1 point for each applicable Skill rating
    let totalDef = 0;
    const parts: string[] = [];
    for (const d of assigned) {
      const calc = this.calculateOperativeDefense(d, threatType);
      totalDef += calc.totalDef;
      const skillName = threatType === 'ass' ? 'ASS' : threatType === 'sub' ? 'SUB' : 'RAID';
      parts.push(`${d.name} (${calc.baseDef + calc.tempBuff}${calc.skillBonus > 0 ? `+${calc.skillBonus} ${skillName}` : ''})`);
    }

    const thwarted = totalDef >= incomingAttack;
    return {
      defenders: assigned,
      totalDef,
      thwarted,
      message: `${assigned.map(d => d.name).join(' + ')} (Total DEF: ${totalDef}) [${parts.join(', ')}]`
    };
  }

  findDefensiveIntercept(defender: Player, threatType: 'raid' | 'ass' | 'sub'): Card | null {
    const chosen = this.selectAiDefenders(defender, threatType, 1);
    return chosen[0] || null;
  }

  resolveSupportSpell(player: Player, opponent: Player, spellName: string) {
    if (spellName === 'Funding') {
      player.current_turn_coins += 3;
      this.log(player.pid, 'SPELL-FUND', '+3 coins added to floating pool.');
    } else if (spellName === 'Assassination Training') {
      const ops = player.battlefield.filter(c => c.type === 'Operative');
      if (ops.length > 0) {
        ops[0].ass = (ops[0].ass || 0) + 2;
        this.log(player.pid, 'SPELL-BUFF', `Trained ${ops[0].name}: Assassin skill +2.`);
      }
    } else if (spellName === 'Raid Training') {
      const ops = player.battlefield.filter(c => c.type === 'Operative');
      if (ops.length > 0) {
        ops[0].raid = (ops[0].raid || 0) + 2;
        this.log(player.pid, 'SPELL-BUFF', `Trained ${ops[0].name}: Raid skill +2.`);
      }
    } else if (spellName === 'Subterfuge Training') {
      const ops = player.battlefield.filter(c => c.type === 'Operative');
      if (ops.length > 0) {
        ops[0].sub = (ops[0].sub || 0) + 2;
        this.log(player.pid, 'SPELL-BUFF', `Trained ${ops[0].name}: Subterfuge skill +2.`);
      }
    } else if (spellName === 'Hired Assassin') {
      const tokExh = this.config.operativeSummonState === 'E';
      for (let i = 0; i < 2; i++) {
        player.battlefield.push({
          id: `hired_ass_${Date.now()}_${i}`,
          name: `Hired Assassin Token ${i + 1}`,
          type: 'Operative',
          cost: 0,
          off: 2,
          def: 2,
          ass: 2,
          raid: 0,
          sub: 0,
          isToken: true,
          exhausted: tokExh
        });
      }
      this.log(player.pid, 'SPELL-SPAWN', `Spawned two 2/2 Assassin Tokens with Assassin 2 ${tokExh ? '(E)' : '(R)'}.`);
    } else if (spellName === 'Hiring Hackers') {
      const stolen = Math.min(this.getTotalSpendableCoins(opponent), 3);
      if (stolen > 0) {
        this.spendCoins(opponent, stolen);
        player.current_turn_coins += stolen;
        player.telemetry.raidedCoinsThisTurn += stolen;
        this.log(player.pid, 'SPELL-HACK', `Siphoned ${stolen} resources from ${opponent.name}.`);
        this.placeMissionTokens(player, 'res_theft', stolen);
      }
    } else if (spellName === 'Hired Subterfuge') {
      const dropped: string[] = [];
      for (let i = 0; i < 2; i++) {
        if (opponent.hand.length > 0) {
          const d = opponent.hand.pop()!;
          opponent.discard_pile.push(d);
          dropped.push(d.name);
          opponent.telemetry.discardedCardFromHandThisTurn = true;
        }
      }
      this.log(player.pid, 'SPELL-SUB', `Hired Subterfuge discarded: [${dropped.join(', ')}].`);
      if (opponent.hand.length === 0 && dropped.length > 0) {
        this.placeMissionTokens(player, 'hand_wipe', 1);
      }
    } else if (spellName === 'Targeted for Whitewash') {
      const enemyOps = opponent.battlefield.filter(c => c.type === 'Operative');
      if (enemyOps.length > 0) {
        const target = enemyOps[0];
        const idx = opponent.battlefield.findIndex(c => c.id === target.id);
        opponent.battlefield.splice(idx, 1);
        opponent.discard_pile.push(target);
        player.telemetry.eliminatedEnemyOpThisTurn = true;
        this.log(player.pid, 'SPELL-WHITEWASH', `Eliminated enemy operative ${target.name}.`);
        this.placeMissionTokens(player, 'kills', 1);
      }
    } else if (spellName === 'Double Agent') {
      const enemyOps = opponent.battlefield.filter(c => c.type === 'Operative');
      if (enemyOps.length > 0) {
        const target = enemyOps[0];
        const idx = opponent.battlefield.findIndex(c => c.id === target.id);
        opponent.battlefield.splice(idx, 1);
        target.exhausted = true;
        player.battlefield.push(target);
        this.log(player.pid, 'SPELL-AGENT', `Converted enemy operative ${target.name} into a double agent! (E)`);
      }
    } else if (spellName === 'Acquisition') {
      const enemyLocs = opponent.battlefield.filter(c => c.type === 'Location');
      if (enemyLocs.length > 0) {
        const target = enemyLocs[0];
        const idx = opponent.battlefield.findIndex(c => c.id === target.id);
        opponent.battlefield.splice(idx, 1);
        target.exhausted = true;
        player.battlefield.push(target);
        this.log(player.pid, 'SPELL-ACQ', `Acquired enemy location ${target.name}! (E)`);
      }
    }
  }

  // Export Match Notation & Event Log Stream as formatted text
  exportMatchLog(): string {
    const timestamp = new Date().toISOString();
    const header = [
      `=============================================================`,
      `SPYWAR - MATCH NOTATION & EVENT LOG STREAM`,
      `Exported: ${timestamp}`,
      `Config: Rounds=${this.config.rounds} | Draw/Turn=${this.config.cardsDrawnPerTurn} | MaxHand=${this.config.maxHandSize} | PointsToWin=${this.config.pointsToWin} | CoinCap=${this.config.affiliationMaxCap} | OpSummonState=${this.config.operativeSummonState} | LocSummonState=${this.config.locationSummonState} | StartMissions=${this.config.startingMissionCards} | MaxMissions=${this.config.maxMissionsInPlay === 0 ? 'No Max' : this.config.maxMissionsInPlay}`,
      `Players: P1=${this.players[0].name} (${this.players[0].affiliation?.name}) | P2=${this.players[1].name} (${this.players[1].affiliation?.name})`,
      `Game Over: ${this.gameOver} | Winner: ${this.winner?.name || 'None'} | Reason: ${this.winReason || 'In Progress'}`,
      `Mission Points: P1=${this.players[0].mission_points} | P2=${this.players[1].mission_points}`,
      `Coins: P1=${this.getTotalSpendableCoins(this.players[0])} | P2=${this.getTotalSpendableCoins(this.players[1])}`,
      `=============================================================`,
      ``,
      `--- EVENT LOG STREAM ---`,
    ];

    const entries = this.logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `[${time}] ${log.round}.${log.actionNumber}.${log.pid}: [${log.code}] ${log.details} [${log.balanceStr}]`;
    });

    return [...header, ...entries].join('\n');
  }

  // Serialize current engine state into plain JavaScript object (safe for Firestore Maps/Lists)
  toSerializable() {
    return {
      config: { ...this.config },
      players: this.players.map(p => ({
        ...p,
        telemetry: {
          ...p.telemetry,
          uniqueOpTypesThisTurn: Array.from(p.telemetry?.uniqueOpTypesThisTurn || [])
        }
      })),
      drawDeck: this.drawDeck,
      missionDeck: this.missionDeck,
      missionsOnTable: this.missionsOnTable,
      currentRound: this.currentRound,
      currentPhase: this.currentPhase,
      activePlayerIndex: this.activePlayerIndex,
      actionCounter: this.actionCounter,
      logs: this.logs,
      gameOver: this.gameOver,
      winnerPid: this.winner?.pid || null,
      winReason: this.winReason || ''
    };
  }

  // Hydrate engine from serialized state
  loadSerializedState(state: any) {
    if (!state) return;
    if (state.config) this.config = { ...this.config, ...state.config };
    if (Array.isArray(state.players)) {
      this.players = state.players.map((p: any) => ({
        ...p,
        telemetry: {
          eliminatedEnemyOpThisTurn: !!p.telemetry?.eliminatedEnemyOpThisTurn,
          raidedCoinsThisTurn: p.telemetry?.raidedCoinsThisTurn || 0,
          discardedCardFromHandThisTurn: !!p.telemetry?.discardedCardFromHandThisTurn,
          operationsConductedThisTurn: p.telemetry?.operationsConductedThisTurn || 0,
          playedNamedThisTurn: !!p.telemetry?.playedNamedThisTurn,
          uniqueOpTypesThisTurn: new Set(p.telemetry?.uniqueOpTypesThisTurn || []),
          cardsPlayedThisTurn: p.telemetry?.cardsPlayedThisTurn || 0
        }
      }));
    }
    if (Array.isArray(state.drawDeck)) this.drawDeck = state.drawDeck;
    if (Array.isArray(state.missionDeck)) this.missionDeck = state.missionDeck;
    if (Array.isArray(state.missionsOnTable)) this.missionsOnTable = state.missionsOnTable;
    if (typeof state.currentRound === 'number') this.currentRound = state.currentRound;
    if (state.currentPhase) this.currentPhase = state.currentPhase;
    if (typeof state.activePlayerIndex === 'number') this.activePlayerIndex = state.activePlayerIndex;
    if (typeof state.actionCounter === 'number') this.actionCounter = state.actionCounter;
    if (Array.isArray(state.logs)) this.logs = state.logs;
    if (typeof state.gameOver === 'boolean') this.gameOver = state.gameOver;
    this.winner = state.winnerPid ? (this.players.find(p => p.pid === state.winnerPid) || null) : null;
    if (state.winReason !== undefined) this.winReason = state.winReason;
  }
}

