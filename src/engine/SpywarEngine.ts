import { Card, Mission, Player, Action, LogEntry, TurnTelemetry, TurnPhase } from '../types/spywar';
import { AFFILIATION_CARDS, LOCATION_CARDS, OPERATIVE_CARDS, SUPPORT_CARDS, MASTER_MISSIONS } from './cardManifest';
import { AbilityParserService } from '../services/abilityParserService';
import { AbilityPresetService } from '../services/abilityPresetService';

export type InitiativeRule = 'HIGHEST_PROD' | 'LOWEST_PROD' | 'RANDOM';

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
  initiativeRule: InitiativeRule;
  allowDuplicateSkillTokens: boolean;
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
  maxMissionsInPlay: 0,
  initiativeRule: 'HIGHEST_PROD',
  allowDuplicateSkillTokens: false
};

export interface MatchTelemetry {
  cardsDrawn: {
    byType: Record<string, number>;
    byCard: Record<string, { id: string; name: string; type: string; count: number }>;
    total: number;
  };
  cardsPlayed: {
    byType: Record<string, number>;
    byCard: Record<string, { id: string; name: string; type: string; count: number }>;
    total: number;
  };
  missionsWon: {
    byMission: Record<string, { id: string; name: string; points: number; count: number; wonByP1: number; wonByP2: number }>;
    byPlayer: Record<'P1' | 'P2', number>;
    total: number;
  };
}

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
  matchTelemetry: MatchTelemetry;

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
    this.matchTelemetry = this.createEmptyMatchTelemetry();
  }

  createEmptyMatchTelemetry(): MatchTelemetry {
    return {
      cardsDrawn: {
        byType: { Operative: 0, Location: 0, Support: 0 },
        byCard: {},
        total: 0
      },
      cardsPlayed: {
        byType: { Operative: 0, Location: 0, Support: 0 },
        byCard: {},
        total: 0
      },
      missionsWon: {
        byMission: {},
        byPlayer: { P1: 0, P2: 0 },
        total: 0
      }
    };
  }

  resetMatchTelemetry() {
    this.matchTelemetry = this.createEmptyMatchTelemetry();
  }

  recordCardDrawn(card: Card) {
    if (!card) return;
    const type = card.type || 'Unknown';
    this.matchTelemetry.cardsDrawn.byType[type] = (this.matchTelemetry.cardsDrawn.byType[type] || 0) + 1;
    this.matchTelemetry.cardsDrawn.total++;
    const cardKey = card.name || card.id;
    if (!this.matchTelemetry.cardsDrawn.byCard[cardKey]) {
      this.matchTelemetry.cardsDrawn.byCard[cardKey] = {
        id: card.id,
        name: card.name,
        type: card.type,
        count: 0
      };
    }
    this.matchTelemetry.cardsDrawn.byCard[cardKey].count++;
  }

  recordCardPlayed(card: Card) {
    if (!card) return;
    const type = card.type || 'Unknown';
    this.matchTelemetry.cardsPlayed.byType[type] = (this.matchTelemetry.cardsPlayed.byType[type] || 0) + 1;
    this.matchTelemetry.cardsPlayed.total++;
    const cardKey = card.name || card.id;
    if (!this.matchTelemetry.cardsPlayed.byCard[cardKey]) {
      this.matchTelemetry.cardsPlayed.byCard[cardKey] = {
        id: card.id,
        name: card.name,
        type: card.type,
        count: 0
      };
    }
    this.matchTelemetry.cardsPlayed.byCard[cardKey].count++;
  }

  recordMissionWon(player: Player, mission: Mission) {
    if (!mission) return;
    const key = mission.name || mission.id;
    if (!this.matchTelemetry.missionsWon.byMission[key]) {
      this.matchTelemetry.missionsWon.byMission[key] = {
        id: mission.id,
        name: mission.name,
        points: mission.points,
        count: 0,
        wonByP1: 0,
        wonByP2: 0
      };
    }
    this.matchTelemetry.missionsWon.byMission[key].count++;
    if (player.pid === 'P1') {
      this.matchTelemetry.missionsWon.byMission[key].wonByP1++;
      this.matchTelemetry.missionsWon.byPlayer.P1++;
    } else {
      this.matchTelemetry.missionsWon.byMission[key].wonByP2++;
      this.matchTelemetry.missionsWon.byPlayer.P2++;
    }
    this.matchTelemetry.missionsWon.total++;
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

  /**
   * Calculates the final spendable resource cost to deploy/play a card,
   * accounting for passive discounts from affiliation and cards in play.
   */
  getCardDeployCost(player: Player, card: Card): number {
    let cost = card.cost || 0;
    const discount = this.getCardDeployDiscount(player, card);
    return Math.max(0, cost - discount);
  }

  /**
   * Calculates total resource discount applied to a card deployment
   * (e.g. "Passive: Operative cost 1 less resource to deploy")
   */
  getCardDeployDiscount(player: Player, card: Card): number {
    let discount = 0;
    const parser = AbilityParserService.getInstance();

    // 1. Check Player Affiliation
    if (player.affiliation) {
      if (player.affiliation.specialAbility === 'play_operative' && card.type === 'Operative') {
        discount += 1;
      } else if (player.affiliation.abilityText || player.affiliation.specialAbility) {
        const parsed = parser.parseAbility(player.affiliation.abilityText || player.affiliation.specialAbility);
        for (const eff of parsed.effects) {
          if (eff.type === 'cost_discount') {
            if (eff.discountCardType === 'any' || eff.discountCardType === card.type) {
              discount += (eff.discountAmount || eff.amount || 1);
            }
          }
        }
      }
    }

    // 2. Check Cards on Battlefield (Locations, Operatives, etc. with persistent passive discount)
    for (const bfCard of player.battlefield) {
      if (bfCard.specialAbility === 'play_operative' && card.type === 'Operative') {
        discount += 1;
      } else if (bfCard.abilityText || bfCard.specialAbility) {
        const parsed = parser.parseAbility(bfCard.abilityText || bfCard.specialAbility);
        for (const eff of parsed.effects) {
          if (eff.type === 'cost_discount') {
            if (eff.discountCardType === 'any' || eff.discountCardType === card.type) {
              discount += (eff.discountAmount || eff.amount || 1);
            }
          }
        }
      }
    }

    return discount;
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
    this.resetMatchTelemetry();

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
      for (const c of p.hand) {
        this.recordCardDrawn(c);
      }

      p.battlefield = [];
      p.discard_pile = [];
      p.completed_missions = [];
      p.mission_points = 0;
      this.resetTurnTelemetry(p);
    }

    // Determine Initiative based on initiativeRule:
    // Option 1: 'HIGHEST_PROD' (Default, Highest Affiliation Production Plays first)
    // Option 2: 'LOWEST_PROD' (Lowest Affiliation Production Plays first)
    // Option 3: 'RANDOM' (Random Initiative, not based on cards)
    const rule: InitiativeRule = this.config.initiativeRule || 'HIGHEST_PROD';
    const prod0 = this.players[0].affiliation?.production || 0;
    const prod1 = this.players[1].affiliation?.production || 0;

    let shouldSwap = false;
    let initiativeReason = '';

    if (rule === 'HIGHEST_PROD') {
      if (prod1 > prod0) {
        shouldSwap = true;
        initiativeReason = `Higher Production (${prod1} > ${prod0})`;
      } else if (prod0 > prod1) {
        shouldSwap = false;
        initiativeReason = `Higher Production (${prod0} > ${prod1})`;
      } else {
        shouldSwap = Math.random() < 0.5;
        initiativeReason = `Tied Production (${prod0} vs ${prod1}) resolved by coin flip`;
      }
    } else if (rule === 'LOWEST_PROD') {
      if (prod1 < prod0) {
        shouldSwap = true;
        initiativeReason = `Lower Production (${prod1} < ${prod0})`;
      } else if (prod0 < prod1) {
        shouldSwap = false;
        initiativeReason = `Lower Production (${prod0} < ${prod1})`;
      } else {
        shouldSwap = Math.random() < 0.5;
        initiativeReason = `Tied Production (${prod0} vs ${prod1}) resolved by coin flip`;
      }
    } else if (rule === 'RANDOM') {
      shouldSwap = Math.random() < 0.5;
      initiativeReason = `Random 50/50 coin flip (card production ignored)`;
    }

    if (shouldSwap) {
      this.players.reverse();
      this.players[0].pid = 'P1';
      this.players[1].pid = 'P2';
      // Sync display names with P1/P2 assignments if standard names are used
      if (this.players[0].isAI && !this.players[1].isAI) {
        this.players[0].name = 'Player 1 (AI)';
        this.players[1].name = 'Player 2 (Human)';
      } else if (!this.players[0].isAI && this.players[1].isAI) {
        this.players[0].name = 'Player 1 (Human)';
        this.players[1].name = 'Player 2 (AI)';
      }
    }

    this.drawDeck = [...locDeck, ...opDeck, ...supDeck].sort(() => Math.random() - 0.5);
    this.activePlayerIndex = 0;

    const ruleLabel = 
      rule === 'HIGHEST_PROD' ? 'Highest Affiliation Production' :
      rule === 'LOWEST_PROD' ? 'Lowest Affiliation Production' : 'Random Initiative';

    this.log('P1', 'SETUP', `Game initialized with '${this.activeDeckName}'. Initiative rule: [${ruleLabel}] -> P1 awarded to ${this.players[0].name} (${this.players[0].affiliation?.name}, Prod: ${this.players[0].affiliation?.production}) due to ${initiativeReason}. P2 is ${this.players[1].name} (${this.players[1].affiliation?.name}, Prod: ${this.players[1].affiliation?.production}).`);
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
        this.recordCardDrawn(c);
      }
    }

    // Hand limit enforcement:
    // Players are allowed to draw cards even if this will exceed maximum hand size.
    // AI discards down to maxHandSize automatically, while human players must discard excess cards of choice.
    if (player.isAI) {
      this.enforceHandLimitForAI(player);
    }

    if (player.hand.length <= this.config.maxHandSize) {
      this.currentPhase = 'OPERATIONS';
    } else {
      this.currentPhase = 'DRAW';
    }

    this.log(player.pid, 'TURN-START', `Turn began for ${player.name} (${player.pid}). [DRAW PHASE] Refreshed cards to Ready (R). Drew: [${drawn.join(', ') || 'None'}]. Hand: ${player.hand.length}/${this.config.maxHandSize}. ${player.hand.length > this.config.maxHandSize ? `[Hand Limit Exceeded: Must discard ${player.hand.length - this.config.maxHandSize} excess card(s) before playing further]` : `Transitioning to [${this.currentPhase} PHASE].`}`);
  }

  enforceHandLimitForAI(player: Player) {
    if (!player.isAI || player.hand.length <= this.config.maxHandSize) return;
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

  /**
   * Draws a single card from the draw deck into player's hand, respecting hand limits
   */
  drawCard(player: Player): Card | null {
    if (this.drawDeck.length > 0) {
      const drawn = this.drawDeck.pop()!;
      player.hand.push(drawn);
      this.recordCardDrawn(drawn);
      if (player.isAI) {
        this.enforceHandLimitForAI(player);
      }
      return drawn;
    }
    return null;
  }

  endPlayerTurn() {
    this.currentPhase = 'CLEANUP';
    const player = this.getActivePlayer();
    const opponent = this.getOpponent();

    // Reset any temporary free deploy sequences
    player.pendingFreeDeploys = undefined;
    opponent.pendingFreeDeploys = undefined;

    // Discard at end of turn keyword and Discard token enforcement:
    // Cards with "Discard at end of turn" or with a Discard token are automatically discarded at the end of the player's turn
    const endTurnDiscards: Card[] = [];
    // 1. Player's battlefield
    for (let i = player.battlefield.length - 1; i >= 0; i--) {
      const c = player.battlefield[i];
      let shouldDiscard = c.discardAtEndOfTurn || c.discardToken;
      if (!shouldDiscard && (c.abilityText || c.specialAbility)) {
        const parsed = AbilityParserService.getInstance().parseAbility(c.abilityText || c.specialAbility);
        if (parsed.discardAtEndOfTurn) {
          shouldDiscard = true;
        }
      }
      if (shouldDiscard) {
        player.battlefield.splice(i, 1);
        player.discard_pile.push(c);
        endTurnDiscards.push(c);
      }
    }
    // 2. Opponent's battlefield (cards that received a Discard token)
    for (let i = opponent.battlefield.length - 1; i >= 0; i--) {
      const c = opponent.battlefield[i];
      if (c.discardToken) {
        opponent.battlefield.splice(i, 1);
        opponent.discard_pile.push(c);
        endTurnDiscards.push(c);
      }
    }
    if (endTurnDiscards.length > 0) {
      this.log(player.pid, 'END-TURN-DISCARD', `Discarded [${endTurnDiscards.map(c => c.name).join(', ')}] from battlefield to discard pile (Keyword: Discard at end of turn / Discard token).`);
    }

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
          this.recordMissionWon(player, mission);
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

    // Rule modification: Hand limit enforcement
    // Players are allowed to draw 1 or more cards even if this will exceed the maximum hand size.
    // But they must first discard excess card(s) of their choice before they are allowed to play further.
    if (player.hand.length > this.config.maxHandSize) {
      const excessCount = player.hand.length - this.config.maxHandSize;
      const cardsToConsider = selectedCard
        ? (player.hand.some(c => c.id === selectedCard.id) ? [selectedCard] : [])
        : player.hand;

      for (const card of cardsToConsider) {
        actions.push({
          type: 'DISCARD_CARD',
          cardId: card.id,
          cardName: card.name,
          card,
          desc: `Discard ${card.name} (Must discard ${excessCount} excess card${excessCount > 1 ? 's' : ''} of choice before playing further. Hand: ${player.hand.length}/${this.config.maxHandSize})`
        });
      }
      return actions;
    }

    // Free Deploy Sequence from "Deploy x card_type" or "Deploy any x" keyword
    if (player.pendingFreeDeploys && player.pendingFreeDeploys.count > 0) {
      const reqType = player.pendingFreeDeploys.cardType;
      const matchingHand = player.hand.filter(c => reqType === 'any' || c.type === reqType);

      if (matchingHand.length > 0) {
        const cardsToDeploy = selectedCard
          ? (matchingHand.some(c => c.id === selectedCard.id) ? [selectedCard] : matchingHand)
          : matchingHand;

        for (const card of cardsToDeploy) {
          actions.push({
            type: 'DEPLOY_FREE_CARD',
            cardId: card.id,
            cardName: card.name,
            card,
            desc: `Deploy ${card.name} (${card.type}, Cost: ${card.cost} -> FREE) [${player.pendingFreeDeploys.count} left from ${player.pendingFreeDeploys.sourceCardName}]`
          });
        }

        actions.push({
          type: 'FINISH_FREE_DEPLOY',
          desc: `Finish Deploying Free Cards (Skip remaining ${player.pendingFreeDeploys.count})`
        });
        return actions;
      } else {
        // No matching cards in hand, cancel pending
        player.pendingFreeDeploys = undefined;
      }
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
        // Deploy action
        const cost = this.getCardDeployCost(player, selectedCard);
        const discount = this.getCardDeployDiscount(player, selectedCard);
        const deployCostDesc = discount > 0 
          ? `Cost: ${selectedCard.cost} -> ${cost} [Discount: -${discount}]`
          : `Cost: ${cost}`;

        if (cost <= spendable) {
          if (selectedCard.name === 'Global Dominion Plan') {
            if (this.canPlayGlobalDominionPlan(player)) {
              actions.push({
                type: 'PLAY_CARD',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                desc: `Deploy Global Dominion Plan (${deployCostDesc}) -> WIN GAME!`
              });
            }
          } else if (selectedCard.specialAbility === 'assemble_strike_defense') {
            actions.push({
              type: 'PLAY_CARD',
              cardId: selectedCard.id,
              cardName: selectedCard.name,
              card: selectedCard,
              subChoice: 'assemble_strike',
              desc: `Play ${selectedCard.name}: Assemble Strike Team (+2 Offense token) (${deployCostDesc})`
            });
            actions.push({
              type: 'PLAY_CARD',
              cardId: selectedCard.id,
              cardName: selectedCard.name,
              card: selectedCard,
              subChoice: 'assemble_defense',
              desc: `Play ${selectedCard.name}: Assemble Defense Team (+2 Defense token) (${deployCostDesc})`
            });
          } else if (selectedCard.type === 'Support') {
            if (this.isSupportPlayable(selectedCard.name, player, opponent)) {
              actions.push({
                type: 'PLAY_CARD',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                desc: `Cast ${selectedCard.name} (${deployCostDesc})`
              });
            }
          } else {
            actions.push({
              type: 'PLAY_CARD',
              cardId: selectedCard.id,
              cardName: selectedCard.name,
              card: selectedCard,
              desc: `Deploy ${selectedCard.name} (${deployCostDesc})`
            });
          }
        } else {
          actions.push({
            type: 'PLAY_CARD',
            cardId: selectedCard.id,
            cardName: selectedCard.name,
            card: selectedCard,
            disabled: true,
            disabledReason: `Requires ${cost} coins (Spendable: ${spendable})`,
            desc: `Deploy ${selectedCard.name} (${deployCostDesc}) [Need ${cost - spendable} more coin(s)]`
          });
        }

        // Clarify operative / location special abilities activate once deployed to battlefield
        if (selectedCard.specialAbility && (selectedCard.type === 'Operative' || selectedCard.type === 'Location')) {
          actions.push({
            type: 'TAP_ABILITY',
            cardId: selectedCard.id,
            cardName: selectedCard.name,
            card: selectedCard,
            disabled: true,
            disabledReason: 'Operative and Location special abilities activate once deployed on the battlefield',
            desc: `Special Ability [${selectedCard.name}]: Deploy to battlefield first`
          });
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
          } else if (player.affiliation.specialAbility === 'buff_skill' || player.affiliation.specialAbility === 'grant_skill_token') {
            const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
            if (friendlyOps.length === 0) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: player.affiliation.id,
                cardName: player.affiliation.name,
                card: player.affiliation,
                disabled: true,
                disabledReason: 'No friendly operatives in play to grant skill buff',
                desc: `${player.affiliation.name} Ability (Unavailable: No friendly operatives in play)`
              });
            } else {
              for (const op of friendlyOps) {
                const canAss = this.config.allowDuplicateSkillTokens || (op.ass || 0) === 0;
                const canRaid = this.config.allowDuplicateSkillTokens || (op.raid || 0) === 0;
                const canSub = this.config.allowDuplicateSkillTokens || (op.sub || 0) === 0;

                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: player.affiliation.id,
                  cardName: player.affiliation.name,
                  card: player.affiliation,
                  targetId: op.id,
                  targetName: op.name,
                  targetCard: op,
                  subChoice: 'buff_ass',
                  disabled: !canAss,
                  disabledReason: !canAss ? `${op.name} already has Assassin skill (Duplicate tokens disallowed in Settings)` : undefined,
                  desc: `Exhaust ${player.affiliation.name}: Grant ${op.name} +1 Assassin skill${!canAss ? ' (Already has ASS)' : ''}`
                });
                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: player.affiliation.id,
                  cardName: player.affiliation.name,
                  card: player.affiliation,
                  targetId: op.id,
                  targetName: op.name,
                  targetCard: op,
                  subChoice: 'buff_raid',
                  disabled: !canRaid,
                  disabledReason: !canRaid ? `${op.name} already has Raid skill (Duplicate tokens disallowed in Settings)` : undefined,
                  desc: `Exhaust ${player.affiliation.name}: Grant ${op.name} +1 Raid skill${!canRaid ? ' (Already has RAID)' : ''}`
                });
                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: player.affiliation.id,
                  cardName: player.affiliation.name,
                  card: player.affiliation,
                  targetId: op.id,
                  targetName: op.name,
                  targetCard: op,
                  subChoice: 'buff_sub',
                  disabled: !canSub,
                  disabledReason: !canSub ? `${op.name} already has Subterfuge skill (Duplicate tokens disallowed in Settings)` : undefined,
                  desc: `Exhaust ${player.affiliation.name}: Grant ${op.name} +1 Subterfuge skill${!canSub ? ' (Already has SUB)' : ''}`
                });
              }
            }
          } else {
            actions.push(...this.generateDynamicActionsForCard(player.affiliation, player, opponent));
          }
        } else {
          actions.push({
            type: 'TAP_PROD',
            cardId: player.affiliation.id,
            cardName: player.affiliation.name,
            card: player.affiliation,
            disabled: true,
            disabledReason: 'Card is exhausted (E) - refreshes to Ready at start of your next turn',
            desc: `${player.affiliation.name} is Exhausted (E) - Refreshes next turn`
          });
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
          if (selectedCard.specialAbility === 'armory_buff' || selectedCard.specialAbility === 'buff_off_or_def') {
            const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
            if (friendlyOps.length === 0) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                disabled: true,
                disabledReason: 'No friendly operatives in play to buff',
                desc: `${selectedCard.name} Buff (Unavailable: No friendly operatives in play)`
              });
            } else {
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
                  desc: `Exhaust ${selectedCard.name}: Give ${op.name} +1 Offense`
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
                  desc: `Exhaust ${selectedCard.name}: Give ${op.name} +1 Defense`
                });
              }
            }
          } else if (selectedCard.specialAbility === 'buff_skill' || selectedCard.specialAbility === 'grant_skill_token') {
            const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
            if (friendlyOps.length === 0) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                disabled: true,
                disabledReason: 'No friendly operatives in play to grant skill token',
                desc: `${selectedCard.name} (Unavailable: No friendly operatives in play)`
              });
            } else {
              for (const op of friendlyOps) {
                const canAss = this.config.allowDuplicateSkillTokens || (op.ass || 0) === 0;
                const canRaid = this.config.allowDuplicateSkillTokens || (op.raid || 0) === 0;
                const canSub = this.config.allowDuplicateSkillTokens || (op.sub || 0) === 0;

                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: selectedCard.id,
                  cardName: selectedCard.name,
                  card: selectedCard,
                  targetId: op.id,
                  targetName: op.name,
                  targetCard: op,
                  subChoice: 'buff_ass',
                  disabled: !canAss,
                  disabledReason: !canAss ? `${op.name} already has Assassin skill (Duplicate tokens disallowed)` : undefined,
                  desc: `Exhaust ${selectedCard.name}: Place +1 Assassin token on ${op.name}${!canAss ? ' (Already has ASS)' : ''}`
                });
                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: selectedCard.id,
                  cardName: selectedCard.name,
                  card: selectedCard,
                  targetId: op.id,
                  targetName: op.name,
                  targetCard: op,
                  subChoice: 'buff_raid',
                  disabled: !canRaid,
                  disabledReason: !canRaid ? `${op.name} already has Raid skill (Duplicate tokens disallowed)` : undefined,
                  desc: `Exhaust ${selectedCard.name}: Place +1 Raid token on ${op.name}${!canRaid ? ' (Already has RAID)' : ''}`
                });
                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: selectedCard.id,
                  cardName: selectedCard.name,
                  card: selectedCard,
                  targetId: op.id,
                  targetName: op.name,
                  targetCard: op,
                  subChoice: 'buff_sub',
                  disabled: !canSub,
                  disabledReason: !canSub ? `${op.name} already has Subterfuge skill (Duplicate tokens disallowed)` : undefined,
                  desc: `Exhaust ${selectedCard.name}: Place +1 Subterfuge token on ${op.name}${!canSub ? ' (Already has SUB)' : ''}`
                });
              }
            }
          } else if (selectedCard.specialAbility === 'troll_farm' || selectedCard.specialAbility === 'force_discard') {
            if (opponent.hand.length === 0) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                disabled: true,
                disabledReason: `${opponent.name}'s hand is empty`,
                desc: `${selectedCard.name} (Unavailable: ${opponent.name}'s hand is empty)`
              });
            } else {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: selectedCard.id,
                cardName: selectedCard.name,
                card: selectedCard,
                desc: `Exhaust ${selectedCard.name}: Force ${opponent.name} to discard a card`
              });
            }
          } else if (selectedCard.specialAbility === 'draw_card') {
            actions.push({
              type: 'TAP_ABILITY',
              cardId: selectedCard.id,
              cardName: selectedCard.name,
              card: selectedCard,
              desc: `Exhaust ${selectedCard.name}: Draw 1 card`
            });
          } else {
            actions.push(...this.generateDynamicActionsForCard(selectedCard, player, opponent));
          }
        } else {
          actions.push({
            type: 'TAP_PROD',
            cardId: selectedCard.id,
            cardName: selectedCard.name,
            card: selectedCard,
            disabled: true,
            disabledReason: 'Card is exhausted (E) - refreshes to Ready at start of your next turn',
            desc: `${selectedCard.name} is Exhausted (E) - Refreshes next turn`
          });
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
            const soloOff = (op.off || 1) + this.getCardStatTokensBuff(op) + (op.ass || 0) + (op.tempOffenseBuff || 0);
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
                teamOff += (rop.off || 1) + this.getCardStatTokensBuff(rop) + (rop.ass || 0) + (rop.tempOffenseBuff || 0);
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
            const soloOff = (op.off || 1) + this.getCardStatTokensBuff(op) + (op.raid || 0) + (op.tempOffenseBuff || 0);
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
                teamOff += (rop.off || 1) + this.getCardStatTokensBuff(rop) + (rop.raid || 0) + (rop.tempOffenseBuff || 0);
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
            const soloOff = (op.off || 1) + this.getCardStatTokensBuff(op) + (op.sub || 0) + (op.tempOffenseBuff || 0);
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
                teamOff += (rop.off || 1) + this.getCardStatTokensBuff(rop) + (rop.sub || 0) + (rop.tempOffenseBuff || 0);
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
            if (eligible.length === 0) {
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                opType: 'boksoon_ass',
                disabled: true,
                disabledReason: 'No enemy operative in play with Assassin skill >= 1',
                desc: `${op.name} Execution (Unavailable: No enemy with Assassin skill ≥ 1)`
              });
            } else {
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
          }
          if (op.specialAbility === 'mata_hari_steal_card') {
            if (opponent.hand.length === 0) {
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                opType: 'mata_hari_steal',
                disabled: true,
                disabledReason: `${opponent.name}'s hand is empty`,
                desc: `${op.name} Charm (Unavailable: ${opponent.name}'s hand is empty)`
              });
            } else {
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                opType: 'mata_hari_steal',
                desc: `Mata Hari Charm: Steal card from ${opponent.name}'s hand`
              });
            }
          }
          if (op.specialAbility === 'ghost_siphon_2') {
            const oppCoins = this.getTotalSpendableCoins(opponent);
            if (oppCoins === 0) {
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                opType: 'ghost_siphon',
                disabled: true,
                disabledReason: `${opponent.name} has 0 spendable resources`,
                desc: `${op.name} Cyber-Siphon (Unavailable: ${opponent.name} has 0 coins)`
              });
            } else {
              actions.push({
                type: 'OPERATIVE_ACTION',
                cardId: op.id,
                cardName: op.name,
                card: op,
                opType: 'ghost_siphon',
                desc: `Ghost Cyber-Siphon: Steal 2 resources from ${opponent.name}`
              });
            }
          }
          if (op.specialAbility === 'dan_weak_sacrifice' || op.specialAbility === 'sacrifice_discard_hand_or_field') {
            const isGeneric = op.specialAbility === 'sacrifice_discard_hand_or_field';
            if (opponent.hand.length > 0) {
              actions.push({
                type: 'DAN_WEAK_SACRIFICE',
                cardId: op.id,
                cardName: op.name,
                card: op,
                subChoice: 'discard_hand',
                desc: isGeneric
                  ? `Sacrifice ${op.name}: Force ${opponent.name} to discard 1 card from hand`
                  : `Sacrifice Dan Weak: Force ${opponent.name} to discard entire hand`
              });
            } else {
              actions.push({
                type: 'DAN_WEAK_SACRIFICE',
                cardId: op.id,
                cardName: op.name,
                card: op,
                subChoice: 'discard_hand',
                disabled: true,
                disabledReason: `${opponent.name}'s hand is already empty`,
                desc: `Sacrifice ${op.name} [Hand Discard] (Unavailable: Opponent hand empty)`
              });
            }
            if (opponent.battlefield.length >= 1) {
              actions.push({
                type: 'DAN_WEAK_SACRIFICE',
                cardId: op.id,
                cardName: op.name,
                card: op,
                subChoice: 'discard_in_play',
                desc: `Sacrifice ${op.name}: Force ${opponent.name} to discard 2 cards in play`
              });
            } else {
              actions.push({
                type: 'DAN_WEAK_SACRIFICE',
                cardId: op.id,
                cardName: op.name,
                card: op,
                subChoice: 'discard_in_play',
                disabled: true,
                disabledReason: `${opponent.name} has no cards in play`,
                desc: `Sacrifice ${op.name} [Field Discard] (Unavailable: Opponent battlefield empty)`
              });
            }
          }

          if (op.specialAbility === 'armory_buff' || op.specialAbility === 'buff_off_or_def') {
            const otherOps = player.battlefield.filter(c => c.type === 'Operative' && c.id !== op.id);
            if (otherOps.length === 0) {
              actions.push({
                type: 'TAP_ABILITY',
                cardId: op.id,
                cardName: op.name,
                card: op,
                disabled: true,
                disabledReason: 'No other operatives in play to buff',
                desc: `Tap ${op.name} (Unavailable: No other operatives in play)`
              });
            } else {
              for (const target of otherOps) {
                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: op.id,
                  cardName: op.name,
                  card: op,
                  targetId: target.id,
                  targetName: target.name,
                  targetCard: target,
                  subChoice: 'buff_off',
                  desc: `Tap ${op.name}: Give ${target.name} +1 Offense`
                });
                actions.push({
                  type: 'TAP_ABILITY',
                  cardId: op.id,
                  cardName: op.name,
                  card: op,
                  targetId: target.id,
                  targetName: target.name,
                  targetCard: target,
                  subChoice: 'buff_def',
                  desc: `Tap ${op.name}: Give ${target.name} +1 Defense`
                });
              }
            }
          }

          if (op.specialAbility === 'buff_skill' || op.specialAbility === 'grant_skill_token') {
            const targets = player.battlefield.filter(c => c.type === 'Operative');
            for (const target of targets) {
              const canAss = this.config.allowDuplicateSkillTokens || (target.ass || 0) === 0;
              const canRaid = this.config.allowDuplicateSkillTokens || (target.raid || 0) === 0;
              const canSub = this.config.allowDuplicateSkillTokens || (target.sub || 0) === 0;

              actions.push({
                type: 'TAP_ABILITY',
                cardId: op.id,
                cardName: op.name,
                card: op,
                targetId: target.id,
                targetName: target.name,
                targetCard: target,
                subChoice: 'buff_ass',
                disabled: !canAss,
                disabledReason: !canAss ? `${target.name} already has Assassin skill` : undefined,
                desc: `Tap ${op.name}: Place +1 Assassin token on ${target.name}${!canAss ? ' (Already has ASS)' : ''}`
              });
              actions.push({
                type: 'TAP_ABILITY',
                cardId: op.id,
                cardName: op.name,
                card: op,
                targetId: target.id,
                targetName: target.name,
                targetCard: target,
                subChoice: 'buff_raid',
                disabled: !canRaid,
                disabledReason: !canRaid ? `${target.name} already has Raid skill` : undefined,
                desc: `Tap ${op.name}: Place +1 Raid token on ${target.name}${!canRaid ? ' (Already has RAID)' : ''}`
              });
              actions.push({
                type: 'TAP_ABILITY',
                cardId: op.id,
                cardName: op.name,
                card: op,
                targetId: target.id,
                targetName: target.name,
                targetCard: target,
                subChoice: 'buff_sub',
                disabled: !canSub,
                disabledReason: !canSub ? `${target.name} already has Subterfuge skill` : undefined,
                desc: `Tap ${op.name}: Place +1 Subterfuge token on ${target.name}${!canSub ? ' (Already has SUB)' : ''}`
              });
            }
          }

          // Dynamic / keyword parsed ability actions for operative
          actions.push(...this.generateDynamicActionsForCard(selectedCard, player, opponent));
        } else {
          actions.push({
            type: 'OPERATIVE_ACTION',
            cardId: selectedCard.id,
            cardName: selectedCard.name,
            card: selectedCard,
            disabled: true,
            disabledReason: 'Card is exhausted (E) - refreshes to Ready at start of your next turn',
            desc: `${selectedCard.name} is Exhausted (E) - Refreshes next turn`
          });
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
      const excess = player.hand.length - this.config.maxHandSize;
      for (const card of player.hand) {
        actions.push({
          type: 'DISCARD_CARD',
          cardId: card.id,
          cardName: card.name,
          card,
          desc: `Discard ${card.name} (Must discard ${excess} excess card${excess > 1 ? 's' : ''} of choice before playing further. Hand: ${player.hand.length}/${this.config.maxHandSize})`
        });
      }
      return actions;
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
      } else if (player.affiliation.specialAbility === 'buff_skill') {
        const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
        for (const op of friendlyOps) {
          actions.push({
            type: 'TAP_ABILITY',
            cardId: player.affiliation.id,
            cardName: player.affiliation.name,
            card: player.affiliation,
            targetId: op.id,
            targetName: op.name,
            targetCard: op,
            subChoice: 'buff_ass',
            desc: `Exhaust ${player.affiliation.name}: Grant ${op.name} +1 Assassin skill`
          });
          actions.push({
            type: 'TAP_ABILITY',
            cardId: player.affiliation.id,
            cardName: player.affiliation.name,
            card: player.affiliation,
            targetId: op.id,
            targetName: op.name,
            targetCard: op,
            subChoice: 'buff_raid',
            desc: `Exhaust ${player.affiliation.name}: Grant ${op.name} +1 Raid skill`
          });
          actions.push({
            type: 'TAP_ABILITY',
            cardId: player.affiliation.id,
            cardName: player.affiliation.name,
            card: player.affiliation,
            targetId: op.id,
            targetName: op.name,
            targetCard: op,
            subChoice: 'buff_sub',
            desc: `Exhaust ${player.affiliation.name}: Grant ${op.name} +1 Subterfuge skill`
          });
        }
      } else {
        actions.push(...this.generateDynamicActionsForCard(player.affiliation, player, opponent));
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
        } else {
          actions.push(...this.generateDynamicActionsForCard(loc, player, opponent));
        }
      }
    }

    // 3. Play Cards from Hand
    for (const card of player.hand) {
      const cost = this.getCardDeployCost(player, card);
      const discount = this.getCardDeployDiscount(player, card);
      const deployCostDesc = discount > 0 
        ? `Cost: ${card.cost} -> ${cost} [Discount: -${discount}]`
        : `Cost: ${cost}`;

      if (cost <= spendable) {
        if (card.name === 'Global Dominion Plan') {
          if (this.canPlayGlobalDominionPlan(player)) {
            actions.push({
              type: 'PLAY_CARD',
              cardId: card.id,
              cardName: card.name,
              card,
              desc: `Deploy Global Dominion Plan (${deployCostDesc}) -> WIN GAME!`
            });
          }
        } else if (card.type === 'Support') {
          if (this.isSupportPlayable(card.name, player, opponent)) {
            actions.push({
              type: 'PLAY_CARD',
              cardId: card.id,
              cardName: card.name,
              card,
              desc: `Cast ${card.name} (${deployCostDesc})`
            });
          }
        } else {
          actions.push({
            type: 'PLAY_CARD',
            cardId: card.id,
            cardName: card.name,
            card,
            desc: `Deploy ${card.name} (${deployCostDesc})`
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
        const soloOff = (op.off || 1) + this.getCardStatTokensBuff(op) + (op.ass || 0) + (op.tempOffenseBuff || 0);
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
            teamOff += (rop.off || 1) + this.getCardStatTokensBuff(rop) + (rop.ass || 0) + (rop.tempOffenseBuff || 0);
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
        const soloOff = (op.off || 1) + this.getCardStatTokensBuff(op) + (op.raid || 0) + (op.tempOffenseBuff || 0);
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
            teamOff += (rop.off || 1) + this.getCardStatTokensBuff(rop) + (rop.raid || 0) + (rop.tempOffenseBuff || 0);
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
        const soloOff = (op.off || 1) + this.getCardStatTokensBuff(op) + (op.sub || 0) + (op.tempOffenseBuff || 0);
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
            teamOff += (rop.off || 1) + this.getCardStatTokensBuff(rop) + (rop.sub || 0) + (rop.tempOffenseBuff || 0);
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

        // Dynamic / keyword parsed ability actions for operative
        actions.push(...this.generateDynamicActionsForCard(op, player, opponent));
      }
    }

    // 5. Pass Turn
    actions.push({
      type: 'PASS',
      desc: 'Pass / End Turn'
    });

    return actions;
  }

  generateDynamicActionsForCard(card: Card, player: Player, opponent: Player): Action[] {
    const actions: Action[] = [];
    if (!card.abilityText && !card.specialAbility) return actions;

    const preset = card.specialAbility ? AbilityPresetService.getInstance().getPresetById(card.specialAbility) : undefined;
    const parsed = AbilityParserService.getInstance().parseAbility(card.abilityText || preset?.description, preset?.config);
    if (!parsed.isValid) return actions;

    // Defense reaction abilities are resolved during attack interception, not as standard turn actions
    if (parsed.trigger === 'reaction_defense') return actions;

    // Check tap condition: cannot tap if already exhausted
    if (parsed.requiresTap && card.exhausted) return actions;

    // Check coin/resource cost condition ("Pay x")
    const costCoins = parsed.costCoins || 0;
    const playerSpendable = this.getTotalSpendableCoins(player);
    const hasEnoughCoins = costCoins <= 0 || playerSpendable >= costCoins;
    const costDisabledReason = !hasEnoughCoins
      ? `Requires ${costCoins} resource(s) (You have ${playerSpendable})`
      : undefined;

    // Determine descriptive prefix
    let prefix = '';
    if (parsed.isPassive) {
      prefix = costCoins > 0 ? `Passive [Pay ${costCoins}] ${card.name}` : `Passive ${card.name}`;
    } else if (parsed.requiresSacrifice) {
      prefix = costCoins > 0 ? `Sacrifice [Pay ${costCoins}] ${card.name}` : `Sacrifice ${card.name}`;
    } else if (parsed.requiresTap) {
      prefix = costCoins > 0 ? `Exhaust [Pay ${costCoins}] ${card.name}` : `Exhaust ${card.name}`;
    } else if (costCoins > 0) {
      prefix = `[Pay ${costCoins}] ${card.name}`;
    } else {
      prefix = `${card.name}`;
    }

    const baseDynamicData = {
      trigger: parsed.trigger,
      costCoins: parsed.costCoins,
      requiresTap: parsed.requiresTap,
      isPassive: parsed.isPassive,
      requiresSacrifice: parsed.requiresSacrifice
    };

    // Draw
    const drawEff = parsed.effects.find(e => e.type === 'draw');
    if (drawEff) {
      actions.push({
        type: 'DYNAMIC_ABILITY',
        cardId: card.id,
        cardName: card.name,
        card,
        dynamicAbilityEffect: { effect: drawEff, ...baseDynamicData },
        disabled: !hasEnoughCoins,
        disabledReason: costDisabledReason,
        desc: `${prefix}: Draw ${drawEff.amount || 1} card(s)`
      });
    }

    // Siphon
    const siphonEff = parsed.effects.find(e => e.type === 'siphon');
    if (siphonEff) {
      const oppSpendable = this.getTotalSpendableCoins(opponent);
      const isOppEmpty = oppSpendable === 0;
      actions.push({
        type: 'DYNAMIC_ABILITY',
        cardId: card.id,
        cardName: card.name,
        card,
        dynamicAbilityEffect: { effect: siphonEff, ...baseDynamicData },
        disabled: !hasEnoughCoins || isOppEmpty,
        disabledReason: !hasEnoughCoins ? costDisabledReason : `${opponent.name} has 0 coins`,
        desc: `${prefix}: Siphon ${siphonEff.amount || 2} coin(s) from ${opponent.name}`
      });
    }

    // Discard Hand
    const discardHandEff = parsed.effects.find(e => e.type === 'discard_hand');
    if (discardHandEff) {
      const isOppHandEmpty = opponent.hand.length === 0;
      actions.push({
        type: 'DYNAMIC_ABILITY',
        cardId: card.id,
        cardName: card.name,
        card,
        dynamicAbilityEffect: { effect: discardHandEff, ...baseDynamicData },
        disabled: !hasEnoughCoins || isOppHandEmpty,
        disabledReason: !hasEnoughCoins ? costDisabledReason : `${opponent.name}'s hand is empty`,
        desc: `${prefix}: Force ${opponent.name} to discard ${discardHandEff.amount || 1} card(s) from hand`
      });
    }

    // Discard Field ("Discard x card in play")
    const discardFieldEff = parsed.effects.find(e => e.type === 'discard_field');
    if (discardFieldEff) {
      const isOppFieldEmpty = opponent.battlefield.length === 0;
      const amt = discardFieldEff.amount || 1;
      if (isOppFieldEmpty) {
        actions.push({
          type: 'DYNAMIC_ABILITY',
          cardId: card.id,
          cardName: card.name,
          card,
          dynamicAbilityEffect: { effect: discardFieldEff, ...baseDynamicData },
          disabled: true,
          disabledReason: `${opponent.name} has no cards in play`,
          desc: `${prefix}: Force ${opponent.name} to discard ${amt} card${amt > 1 ? 's' : ''} in play (None in play)`
        });
      } else {
        // Individual targeting options for each opponent card in play
        for (const targetCard of opponent.battlefield) {
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            targetId: targetCard.id,
            targetName: targetCard.name,
            targetCard,
            subChoice: `discard_field_${targetCard.id}`,
            dynamicAbilityEffect: { effect: { ...discardFieldEff, targetCardId: targetCard.id }, ...baseDynamicData },
            disabled: !hasEnoughCoins,
            disabledReason: costDisabledReason,
            desc: `${prefix}: Force ${opponent.name} to discard ${targetCard.name} in play`
          });
        }
      }
    }

    // Spawn Token
    const spawnEff = parsed.effects.find(e => e.type === 'spawn_token');
    if (spawnEff) {
      actions.push({
        type: 'DYNAMIC_ABILITY',
        cardId: card.id,
        cardName: card.name,
        card,
        dynamicAbilityEffect: { effect: spawnEff, ...baseDynamicData },
        disabled: !hasEnoughCoins,
        disabledReason: costDisabledReason,
        desc: `${prefix}: Spawn a ${spawnEff.tokenOff || 1}/${spawnEff.tokenDef || 1} ${spawnEff.tokenName || 'Operative'} token`
      });
    }

    // Produce Coins
    const prodEff = parsed.effects.find(e => e.type === 'produce_coins');
    if (prodEff) {
      actions.push({
        type: 'DYNAMIC_ABILITY',
        cardId: card.id,
        cardName: card.name,
        card,
        dynamicAbilityEffect: { effect: prodEff, ...baseDynamicData },
        disabled: !hasEnoughCoins,
        disabledReason: costDisabledReason,
        desc: `${prefix}: Produce +${prodEff.amount || 1} coin(s)`
      });
    }

    // Gain x Resource (fixed amount)
    const gainResEff = parsed.effects.find(e => e.type === 'gain_resource');
    if (gainResEff) {
      const amt = gainResEff.amount || 1;
      actions.push({
        type: 'DYNAMIC_ABILITY',
        cardId: card.id,
        cardName: card.name,
        card,
        dynamicAbilityEffect: { effect: gainResEff, ...baseDynamicData },
        disabled: !hasEnoughCoins,
        disabledReason: costDisabledReason,
        desc: `${prefix}: Gain +${amt} Spendable Resource${amt > 1 ? 's' : ''}`
      });
    }

    // Gain x Resource equal to discarded card cost
    const gainDiscardCostEff = parsed.effects.find(e => e.type === 'gain_resource_discard_cost');
    if (gainDiscardCostEff) {
      if (player.hand.length === 0) {
        actions.push({
          type: 'DYNAMIC_ABILITY',
          cardId: card.id,
          cardName: card.name,
          card,
          disabled: true,
          disabledReason: 'No cards in hand to discard',
          desc: `${prefix}: Discard 1 card from hand to gain resource equal to cost (Hand is empty)`
        });
      } else {
        for (const handCard of player.hand) {
          const resGained = handCard.cost || 0;
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            targetId: handCard.id,
            targetName: handCard.name,
            targetCard: handCard,
            subChoice: `discard_for_resource_${handCard.id}`,
            dynamicAbilityEffect: { effect: gainDiscardCostEff, ...baseDynamicData },
            disabled: !hasEnoughCoins,
            disabledReason: costDisabledReason,
            desc: `${prefix}: Discard ${handCard.name} (Cost: ${handCard.cost}) to gain +${resGained} Spendable Resource${resGained === 1 ? '' : 's'}`
          });
        }
      }
    }

    // Choice (e.g. +1 OFF or +1 DEF)
    const choiceEff = parsed.effects.find(e => e.type === 'choice');
    if (choiceEff && choiceEff.choices) {
      if (parsed.targetType === 'friendly_op') {
        const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
        if (friendlyOps.length === 0) {
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            disabled: true,
            disabledReason: 'No friendly operatives in play to target',
            desc: `${prefix} (Unavailable: No friendly operatives in play)`
          });
        } else {
          for (const op of friendlyOps) {
            choiceEff.choices.forEach((c, idx) => {
              const label = choiceEff.choiceLabels?.[idx] || c.rawPhrase || `Option ${idx + 1}`;
              actions.push({
                type: 'DYNAMIC_ABILITY',
                cardId: card.id,
                cardName: card.name,
                card,
                targetId: op.id,
                targetName: op.name,
                targetCard: op,
                subChoice: `choice_${idx}`,
                dynamicAbilityEffect: { effect: c, ...baseDynamicData },
                disabled: !hasEnoughCoins,
                disabledReason: costDisabledReason,
                desc: `${prefix}: Give ${op.name} [${label}]`
              });
            });
          }
        }
      } else {
        choiceEff.choices.forEach((c, idx) => {
          const label = choiceEff.choiceLabels?.[idx] || c.rawPhrase || `Option ${idx + 1}`;
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            subChoice: `choice_${idx}`,
            dynamicAbilityEffect: { effect: c, ...baseDynamicData },
            disabled: !hasEnoughCoins,
            disabledReason: costDisabledReason,
            desc: `${prefix}: ${label}`
          });
        });
      }
    }

    // Stat Buff
    const buffEff = parsed.effects.find(e => e.type === 'buff_stat');
    if (buffEff && !choiceEff) {
      const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
      if (friendlyOps.length === 0) {
        actions.push({
          type: 'DYNAMIC_ABILITY',
          cardId: card.id,
          cardName: card.name,
          card,
          disabled: true,
          disabledReason: 'No friendly operatives in play to buff',
          desc: `${prefix} (Unavailable: No friendly operatives in play)`
        });
      } else {
        for (const op of friendlyOps) {
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            targetId: op.id,
            targetName: op.name,
            targetCard: op,
            dynamicAbilityEffect: { effect: buffEff, ...baseDynamicData },
            disabled: !hasEnoughCoins,
            disabledReason: costDisabledReason,
            desc: `${prefix}: Give ${op.name} +${buffEff.amount || 1} ${buffEff.stat === 'off' ? 'Offense' : 'Defense'}`
          });
        }
      }
    }

    // Token Buffs (+x/+x Tech, Weapon, Suit, Powered armor, Power Suit, Discard, or Skill tokens)
    const tokenEff = parsed.effects.find(e => e.type === 'grant_token');
    if (tokenEff) {
      const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
      const tokenType = tokenEff.tokenType || (tokenEff.stat === 'both' ? 'tech' : 'skill');

      if (tokenType === 'discard') {
        // Discard token: placed on top of a card (friendly operative or opponent in-play card)
        const allCandidates = [...friendlyOps, ...opponent.battlefield];
        if (allCandidates.length === 0) {
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            disabled: true,
            disabledReason: 'No valid cards in play to receive Discard token',
            desc: `${prefix} (Unavailable: No cards in play)`
          });
        } else {
          for (const target of allCandidates) {
            const hasDiscardToken = !!target.discardToken;
            actions.push({
              type: 'DYNAMIC_ABILITY',
              cardId: card.id,
              cardName: card.name,
              card,
              targetId: target.id,
              targetName: target.name,
              targetCard: target,
              subChoice: 'token_discard',
              dynamicAbilityEffect: { effect: tokenEff, ...baseDynamicData },
              disabled: !hasEnoughCoins || hasDiscardToken,
              disabledReason: !hasEnoughCoins ? costDisabledReason : `${target.name} already has a Discard token (Stacking same token disallowed)`,
              desc: `${prefix}: Place Discard token on ${target.name}${hasDiscardToken ? ' (Already has Discard token)' : ''}`
            });
          }
        }
      } else if (friendlyOps.length === 0) {
        actions.push({
          type: 'DYNAMIC_ABILITY',
          cardId: card.id,
          cardName: card.name,
          card,
          disabled: true,
          disabledReason: 'No friendly operatives in play to grant token',
          desc: `${prefix} (Unavailable: No friendly operatives in play)`
        });
      } else {
        const amt = tokenEff.amount || 1;

        if (tokenType === 'tech' || tokenType === 'weapon' || tokenType === 'suit' || tokenType === 'powered_armor' || tokenType === 'power_suit' || tokenEff.stat === 'both') {
          // Stat tokens buff both OFF and DEF by x. Same tokens cannot be stacked together on a single card.
          // If a player has more than one valid Operative card, the Player selects which Operative card receives the token.
          let tokenLabel = 'Tech';
          let tokenKey: 'techTokens' | 'weaponTokens' | 'suitTokens' | 'poweredArmorTokens' | 'powerSuitTokens' = 'techTokens';
          if (tokenType === 'weapon') {
            tokenLabel = 'Weapon';
            tokenKey = 'weaponTokens';
          } else if (tokenType === 'suit') {
            tokenLabel = 'Suit';
            tokenKey = 'suitTokens';
          } else if (tokenType === 'powered_armor') {
            tokenLabel = 'Powered armor';
            tokenKey = 'poweredArmorTokens';
          } else if (tokenType === 'power_suit') {
            tokenLabel = 'Power Suit';
            tokenKey = 'powerSuitTokens';
          }

          for (const op of friendlyOps) {
            const hasSameToken = ((op[tokenKey] as number) || 0) > 0;
            actions.push({
              type: 'DYNAMIC_ABILITY',
              cardId: card.id,
              cardName: card.name,
              card,
              targetId: op.id,
              targetName: op.name,
              targetCard: op,
              subChoice: `token_${tokenType}`,
              dynamicAbilityEffect: { effect: tokenEff, ...baseDynamicData },
              disabled: !hasEnoughCoins || hasSameToken,
              disabledReason: !hasEnoughCoins ? costDisabledReason : `${op.name} already has a ${tokenLabel} token (Stacking same token disallowed)`,
              desc: `${prefix}: Select ${op.name} to receive +${amt}/+${amt} ${tokenLabel} token${hasSameToken ? ' (Already has this token)' : ''}`
            });
          }
        } else {
          // Standard Skill token (ASS / RAID / SUB)
          // Rule: If an Operative card already had Raid skill, it can no longer receive a Raid token (same for ASS and SUB).
          const skillsToOffer: ('ass' | 'raid' | 'sub')[] = tokenEff.skillOptions || (tokenEff.skill ? [tokenEff.skill] : ['ass', 'raid', 'sub']);
          for (const op of friendlyOps) {
            for (const sk of skillsToOffer) {
              const hasSkill = (op[sk] || 0) > 0;
              const canGive = !hasSkill; // Stacking same skill token or granting skill to card that already had it is disallowed
              actions.push({
                type: 'DYNAMIC_ABILITY',
                cardId: card.id,
                cardName: card.name,
                card,
                targetId: op.id,
                targetName: op.name,
                targetCard: op,
                subChoice: `token_${sk}`,
                dynamicAbilityEffect: { effect: { ...tokenEff, skill: sk }, ...baseDynamicData },
                disabled: !hasEnoughCoins || !canGive,
                disabledReason: !hasEnoughCoins ? costDisabledReason : `${op.name} already has ${sk.toUpperCase()} skill (Cannot receive duplicate ${sk.toUpperCase()} token)`,
                desc: `${prefix}: Select ${op.name} to receive +1 ${sk.toUpperCase()} token${!canGive ? ' (Already has skill)' : ''}`
              });
            }
          }
        }
      }
    }

    // Deploy Card effect ("Deploy x card_type" or "Deploy any x")
    const deployEff = parsed.effects.find(e => e.type === 'deploy_card');
    if (deployEff) {
      const reqType = deployEff.deployCardType || 'any';
      const deployCount = deployEff.deployCount || deployEff.amount || 1;
      const typeLabel = reqType === 'any' ? 'card' : `${reqType} card`;
      const matchingHand = player.hand.filter(c => reqType === 'any' || c.type === reqType);

      if (matchingHand.length === 0) {
        actions.push({
          type: 'DYNAMIC_ABILITY',
          cardId: card.id,
          cardName: card.name,
          card,
          disabled: true,
          disabledReason: `No ${reqType === 'any' ? '' : reqType + ' '}cards in hand to deploy`,
          desc: `${prefix}: Deploy ${deployCount} ${typeLabel}${deployCount > 1 ? 's' : ''} (None in hand)`
        });
      } else {
        for (const handCard of matchingHand) {
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            targetId: handCard.id,
            targetName: handCard.name,
            targetCard: handCard,
            dynamicAbilityEffect: { effect: deployEff, ...baseDynamicData },
            disabled: !hasEnoughCoins,
            disabledReason: costDisabledReason,
            desc: `${prefix}: Deploy ${handCard.name} (${handCard.type}, Cost: ${handCard.cost} -> FREE)`
          });
        }
      }
    }

    // Exhaust effect: put one or more of opponent's card to Exhaust condition
    const exhaustEff = parsed.effects.find(e => e.type === 'exhaust_card');
    if (exhaustEff) {
      let eligibleTargets = opponent.battlefield.filter(c => !c.exhausted);
      if (exhaustEff.exhaustTargetType === 'operative') {
        eligibleTargets = eligibleTargets.filter(c => c.type === 'Operative');
      } else if (exhaustEff.exhaustTargetType === 'location') {
        eligibleTargets = eligibleTargets.filter(c => c.type === 'Location');
      }

      if (eligibleTargets.length === 0) {
        actions.push({
          type: 'DYNAMIC_ABILITY',
          cardId: card.id,
          cardName: card.name,
          card,
          disabled: true,
          disabledReason: "Opponent has no ready cards in play to exhaust",
          desc: `${prefix} (Unavailable: No ready opponent cards to exhaust)`,
          isSpecialAbilityAttack: true
        });
      } else {
        for (const oppCard of eligibleTargets) {
          actions.push({
            type: 'DYNAMIC_ABILITY',
            cardId: card.id,
            cardName: card.name,
            card,
            targetId: oppCard.id,
            targetName: oppCard.name,
            targetCard: oppCard,
            dynamicAbilityEffect: { effect: exhaustEff, ...baseDynamicData },
            disabled: !hasEnoughCoins,
            disabledReason: costDisabledReason,
            desc: `${prefix}: Exhaust opponent's ${oppCard.name} (${oppCard.type})`,
            isSpecialAbilityAttack: true
          });
        }
      }
    }

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

  /**
   * Puts 1 card from hand directly into play without paying the card cost.
   * Handles Support, Operative, and Location types.
   */
  deployCardFromHandFree(
    player: Player,
    opponent: Player,
    cardToDeploy: Card,
    sourceCard?: Card
  ): { success: boolean; message: string } {
    const idx = player.hand.findIndex(c => c.id === cardToDeploy.id);
    if (idx !== -1) {
      player.hand.splice(idx, 1);
    }

    player.telemetry.cardsPlayedThisTurn++;
    this.recordCardPlayed(cardToDeploy);

    if (cardToDeploy.isNamed) {
      player.telemetry.playedNamedThisTurn = true;
      this.placeMissionTokens(player, 'play_named', 1);
    }

    const sourceLabel = sourceCard ? ` via ${sourceCard.name}` : '';

    if (cardToDeploy.type === 'Location') {
      const locExh = this.config.locationSummonState === 'E';
      const inst: Card = { ...cardToDeploy, stored_coins: 0, exhausted: locExh };
      player.battlefield.push(inst);
      this.log(player.pid, 'DEPLOY-FREE', `Deployed Location for FREE${sourceLabel}: ${cardToDeploy.name} (Original Cost: ${cardToDeploy.cost}) ${locExh ? '(E)' : '(R)'}.`);
      return { success: true, message: `Deployed Location ${cardToDeploy.name} for FREE.` };
    }

    if (cardToDeploy.type === 'Operative') {
      const opExh = this.config.operativeSummonState === 'E';
      const inst: Card = { ...cardToDeploy, exhausted: opExh };
      player.battlefield.push(inst);
      this.log(player.pid, 'DEPLOY-FREE', `Deployed Operative for FREE${sourceLabel}: ${cardToDeploy.name} (Original Cost: ${cardToDeploy.cost}) [Off:${cardToDeploy.off}/Def:${cardToDeploy.def}] ${opExh ? '(E)' : '(R)'}.`);

      // Ghost / ghost_siphon_2
      if (cardToDeploy.name === 'Ghost' || cardToDeploy.specialAbility === 'ghost_siphon_2') {
        const stolen = Math.min(this.getTotalSpendableCoins(opponent), 2);
        if (stolen > 0) {
          this.spendCoins(opponent, stolen);
          player.current_turn_coins += stolen;
          this.log(player.pid, 'GHOST-SIPHON', `Ghost triggered on deployment! Siphoned ${stolen} coin(s) from ${opponent.name}.`);
        }
      }

      // Check for dynamic "On Deploy" trigger
      if (cardToDeploy.abilityText || cardToDeploy.specialAbility) {
        const parsed = AbilityParserService.getInstance().parseAbility(cardToDeploy.abilityText || cardToDeploy.specialAbility);
        if (parsed.trigger === 'deploy' && parsed.isValid) {
          for (const eff of parsed.effects) {
            if (eff.type === 'draw') {
              const amt = eff.amount || 1;
              for (let i = 0; i < amt; i++) this.drawCard(player);
              this.log(player.pid, 'DYNAMIC-DEPLOY', `${cardToDeploy.name} On-Deploy: drew ${amt} card(s).`);
            } else if (eff.type === 'siphon') {
              const amt = eff.amount || 1;
              const stolen = Math.min(this.getTotalSpendableCoins(opponent), amt);
              if (stolen > 0) {
                this.spendCoins(opponent, stolen);
                player.current_turn_coins += stolen;
                this.log(player.pid, 'DYNAMIC-DEPLOY', `${cardToDeploy.name} On-Deploy: siphoned ${stolen} coin(s).`);
              }
            } else if (eff.type === 'produce_coins' || eff.type === 'gain_resource') {
              const amt = eff.amount || 1;
              player.current_turn_coins += amt;
              this.log(player.pid, 'DYNAMIC-DEPLOY', `${cardToDeploy.name} On-Deploy: gained +${amt} resource(s).`);
            } else if (eff.type === 'buff_stat') {
              const amt = eff.amount || 1;
              if (eff.stat === 'off') {
                inst.tempOffenseBuff = (inst.tempOffenseBuff || 0) + amt;
              } else {
                inst.tempDefenseBuff = (inst.tempDefenseBuff || 0) + amt;
              }
              this.log(player.pid, 'DYNAMIC-DEPLOY', `${cardToDeploy.name} On-Deploy: gained +${amt} ${eff.stat?.toUpperCase()}.`);
            }
          }
        }
      }

      return { success: true, message: `Deployed Operative ${cardToDeploy.name} for FREE.` };
    }

    if (cardToDeploy.type === 'Support') {
      player.discard_pile.push(cardToDeploy);
      this.log(player.pid, 'DEPLOY-FREE', `Cast Support for FREE${sourceLabel}: ${cardToDeploy.name} (Original Cost: ${cardToDeploy.cost}). Resolving effects...`);
      this.resolveSupportSpell(player, opponent, cardToDeploy.name);

      if (cardToDeploy.abilityText || cardToDeploy.specialAbility) {
        const parsed = AbilityParserService.getInstance().parseAbility(cardToDeploy.abilityText || cardToDeploy.specialAbility);
        const deployEff = parsed.effects.find(e => e.type === 'deploy_card');
        if (deployEff) {
          const reqType = deployEff.deployCardType || 'any';
          const totalCount = deployEff.deployCount || deployEff.amount || 1;
          const matchingHand = player.hand.filter(c => reqType === 'any' || c.type === reqType);
          if (matchingHand.length > 0) {
            player.pendingFreeDeploys = {
              count: totalCount,
              cardType: reqType,
              sourceCardName: cardToDeploy.name
            };
            this.log(player.pid, 'FREE-DEPLOY', `${cardToDeploy.name} activated: Choose up to ${totalCount} ${reqType === 'any' ? '' : reqType + ' '}card(s) to deploy for FREE.`);
          }
        }
      }
      return { success: true, message: `Cast Support ${cardToDeploy.name} for FREE.` };
    }

    return { success: true, message: `Deployed ${cardToDeploy.name} for FREE.` };
  }

  // ==========================================
  // ACTION EXECUTION & DEFENSIVE INTERCEPTS
  // ==========================================
  executeAction(
    player: Player,
    opponent: Player,
    action: Action,
    defenderCardIds?: string[],
    bonusDefense: number = 0
  ): { success: boolean; thwarted?: boolean; message: string; defendersUsed?: Card[]; totalDef?: number } {
    // Hand limit enforcement rule:
    // Players are allowed to draw cards even if this exceeds maxHandSize, but they MUST first
    // discard excess card(s) of their choice before they are allowed to play further.
    if (player.hand.length > this.config.maxHandSize && action.type !== 'DISCARD_CARD') {
      const excess = player.hand.length - this.config.maxHandSize;
      return {
        success: false,
        message: `Hand limit exceeded (${player.hand.length}/${this.config.maxHandSize}). You must first discard ${excess} excess card${excess > 1 ? 's' : ''} of your choice before playing further.`
      };
    }

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
      const card = action.card || player.hand.find(c => c.id === action.cardId);
      if (!card) {
        return { success: false, message: 'Card not found in hand.' };
      }
      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.discard_pile.push(card);
        player.telemetry.discardedCardFromHandThisTurn = true;
        this.log(player.pid, 'DISCARD', `Discarded '${card.name}' from hand to discard pile. Hand: ${player.hand.length}/${this.config.maxHandSize}.`);
        if (player.hand.length <= this.config.maxHandSize) {
          if (this.currentPhase === 'DRAW') {
            this.currentPhase = 'OPERATIONS';
            this.log(player.pid, 'PHASE', `Hand size within limit (${player.hand.length}/${this.config.maxHandSize}). Transitioned to OPERATIONS Phase.`);
          } else {
            this.log(player.pid, 'HAND-LIMIT', `Hand size within limit (${player.hand.length}/${this.config.maxHandSize}). Player may now take operations.`);
          }
          return {
            success: true,
            message: `Discarded ${card.name}. Hand size is now within limit (${player.hand.length}/${this.config.maxHandSize}). You may now take actions.`
          };
        } else {
          const remainingExcess = player.hand.length - this.config.maxHandSize;
          return {
            success: true,
            message: `Discarded ${card.name}. You must discard ${remainingExcess} more excess card${remainingExcess > 1 ? 's' : ''} (Hand: ${player.hand.length}/${this.config.maxHandSize}).`
          };
        }
      }
      return { success: false, message: 'Card not found in hand.' };
    }

    if (action.type === 'FINISH_FREE_DEPLOY') {
      const sourceName = player.pendingFreeDeploys?.sourceCardName || 'Free Deploy';
      player.pendingFreeDeploys = undefined;
      this.log(player.pid, 'FREE-DEPLOY', `${player.name} finished free deployment sequence (${sourceName}).`);
      return { success: true, message: 'Finished free deployment.' };
    }

    if (action.type === 'DEPLOY_FREE_CARD') {
      const cardToDeploy = action.card || player.hand.find(c => c.id === action.cardId);
      if (!cardToDeploy) {
        return { success: false, message: 'Card not found in hand to deploy.' };
      }
      const sourceCardName = player.pendingFreeDeploys?.sourceCardName;
      const deployRes = this.deployCardFromHandFree(player, opponent, cardToDeploy, sourceCardName ? { name: sourceCardName } as Card : undefined);
      if (deployRes.success && player.pendingFreeDeploys) {
        player.pendingFreeDeploys.count--;
        const reqType = player.pendingFreeDeploys.cardType;
        const stillHasMatching = player.hand.some(c => reqType === 'any' || c.type === reqType);
        if (player.pendingFreeDeploys.count <= 0 || !stillHasMatching) {
          player.pendingFreeDeploys = undefined;
        }
      }
      return deployRes;
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
        if (this.drawDeck.length > 0) {
          const drawn = this.drawDeck.pop()!;
          player.hand.push(drawn);
          this.recordCardDrawn(drawn);
          if (player.isAI) {
            this.enforceHandLimitForAI(player);
          }
          this.log(player.pid, 'LOC-ABILITY', `${card.name} tapped: Drew '${drawn.name}'. Hand: ${player.hand.length}/${this.config.maxHandSize}.`);
          const notice = player.hand.length > this.config.maxHandSize
            ? ` (Hand limit exceeded: ${player.hand.length}/${this.config.maxHandSize}. Must discard ${player.hand.length - this.config.maxHandSize} excess card(s) of choice before taking further actions.)`
            : '';
          return { success: true, message: `Drew ${drawn.name}.${notice}` };
        }
        return { success: false, message: 'Draw deck is empty.' };
      }

      if (card.specialAbility === 'armory_buff' || card.specialAbility === 'buff_off_or_def') {
        const target = action.targetCard!;
        if (action.subChoice === 'buff_off') {
          target.tempOffenseBuff = (target.tempOffenseBuff || 0) + 1;
          this.log(player.pid, 'ABILITY', `${card.name} granted +1 Offense to ${target.name}.`);
          return { success: true, message: `Granted +1 Offense to ${target.name}.` };
        } else {
          target.tempDefenseBuff = (target.tempDefenseBuff || 0) + 1;
          this.log(player.pid, 'ABILITY', `${card.name} granted +1 Defense to ${target.name}.`);
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

      if (card.specialAbility === 'buff_skill' || card.specialAbility === 'grant_skill_token') {
        const target = action.targetCard!;
        if (action.subChoice === 'buff_ass') {
          if ((target.ass || 0) > 0 && !this.config.allowDuplicateSkillTokens) {
            return { success: false, message: `${target.name} already has Assassin skill (Duplicate skill tokens disallowed).` };
          }
          target.ass = (target.ass || 0) + 1;
          this.log(player.pid, 'ABILITY', `${card.name} granted +1 Assassin token to ${target.name} (Total ASS: ${target.ass}).`);
          return { success: true, message: `Granted +1 Assassin token to ${target.name}.` };
        } else if (action.subChoice === 'buff_raid') {
          if ((target.raid || 0) > 0 && !this.config.allowDuplicateSkillTokens) {
            return { success: false, message: `${target.name} already has Raid skill (Duplicate skill tokens disallowed).` };
          }
          target.raid = (target.raid || 0) + 1;
          this.log(player.pid, 'ABILITY', `${card.name} granted +1 Raid token to ${target.name} (Total RAID: ${target.raid}).`);
          return { success: true, message: `Granted +1 Raid token to ${target.name}.` };
        } else if (action.subChoice === 'buff_sub') {
          if ((target.sub || 0) > 0 && !this.config.allowDuplicateSkillTokens) {
            return { success: false, message: `${target.name} already has Subterfuge skill (Duplicate skill tokens disallowed).` };
          }
          target.sub = (target.sub || 0) + 1;
          this.log(player.pid, 'ABILITY', `${card.name} granted +1 Subterfuge token to ${target.name} (Total SUB: ${target.sub}).`);
          return { success: true, message: `Granted +1 Subterfuge token to ${target.name}.` };
        }
      }
    }

    if (action.type === 'DYNAMIC_ABILITY') {
      const card = action.card!;
      const effData = action.dynamicAbilityEffect;
      const effect = effData?.effect;
      const trigger = effData?.trigger || 'tap';

      // 1. Pay Resource Cost ("Pay x")
      const costCoins = effData?.costCoins || 0;
      if (costCoins > 0) {
        const spendable = this.getTotalSpendableCoins(player);
        if (spendable < costCoins) {
          return { success: false, message: `Cannot activate: requires ${costCoins} resource(s), but only ${spendable} available.` };
        }
        this.spendCoins(player, costCoins);
        this.log(player.pid, 'PAY-RESOURCE', `Paid ${costCoins} resource(s) to activate ${card.name} ability.`);
      }

      // 2. Check Tap vs Passive (Passive cards do NOT exhaust when using special ability)
      const shouldExhaust = effData?.requiresTap ?? (trigger === 'tap');
      const isPassive = effData?.isPassive ?? (trigger === 'passive');

      if (shouldExhaust && !isPassive) {
        card.exhausted = true;
      }

      if (trigger === 'sacrifice' || effData?.requiresSacrifice) {
        const bIdx = player.battlefield.findIndex(c => c.id === card.id);
        if (bIdx !== -1) {
          player.battlefield.splice(bIdx, 1);
        }
        player.discard_pile.push(card);
        this.log(player.pid, 'SACRIFICE', `${card.name} was sacrificed.`);
      }

      if (!effect) {
        return { success: true, message: `Activated ${card.name} ability.` };
      }

      // 2. Resolve specific atomic effect
      if (effect.type === 'draw') {
        const count = effect.amount || 1;
        const drawnCards: string[] = [];
        for (let i = 0; i < count; i++) {
          if (this.drawDeck.length > 0) {
            const drawn = this.drawDeck.pop()!;
            player.hand.push(drawn);
            this.recordCardDrawn(drawn);
            drawnCards.push(drawn.name);
          }
        }
        if (player.isAI) {
          this.enforceHandLimitForAI(player);
        }
        if (drawnCards.length > 0) {
          const notice = player.hand.length > this.config.maxHandSize
            ? ` (Hand limit exceeded: ${player.hand.length}/${this.config.maxHandSize}. Must discard ${player.hand.length - this.config.maxHandSize} excess card(s) of choice before taking further actions.)`
            : '';
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} drew ${drawnCards.length} card(s): ${drawnCards.join(', ')}. Hand: ${player.hand.length}/${this.config.maxHandSize}.`);
          return { success: true, message: `Drew ${drawnCards.join(', ')}.${notice}` };
        }
        return { success: false, message: 'Draw deck is empty.' };
      }

      if (effect.type === 'siphon') {
        const count = effect.amount || 2;
        const stolen = Math.min(this.getTotalSpendableCoins(opponent), count);
        if (stolen > 0) {
          this.spendCoins(opponent, stolen);
          player.current_turn_coins += stolen;
          player.telemetry.raidedCoinsThisTurn += stolen;
          this.placeMissionTokens(player, 'res_theft', stolen);
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} siphoned ${stolen} coin(s) from ${opponent.name}.`);
          return { success: true, message: `Siphoned ${stolen} coin(s) from ${opponent.name}.` };
        }
        return { success: false, message: `${opponent.name} has no coins to siphon.` };
      }

      if (effect.type === 'discard_hand') {
        const count = effect.amount || 1;
        const droppedNames: string[] = [];
        for (let i = 0; i < count && opponent.hand.length > 0; i++) {
          const dropped = opponent.hand.pop()!;
          opponent.discard_pile.push(dropped);
          droppedNames.push(dropped.name);
        }
        if (droppedNames.length > 0) {
          opponent.telemetry.discardedCardFromHandThisTurn = true;
          if (opponent.hand.length === 0) {
            this.placeMissionTokens(player, 'hand_wipe', 1);
          }
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} forced ${opponent.name} to discard: ${droppedNames.join(', ')}.`);
          return { success: true, message: `Forced ${opponent.name} to discard ${droppedNames.join(', ')}.` };
        }
        return { success: false, message: `${opponent.name}'s hand is empty.` };
      }

      if (effect.type === 'discard_field') {
        const count = effect.amount || 1;
        // Check if specific card was selected
        const targetToDiscard = action.targetCard || opponent.battlefield.find(c => c.id === action.targetId);
        if (targetToDiscard) {
          const tIdx = opponent.battlefield.findIndex(c => c.id === targetToDiscard.id);
          if (tIdx !== -1) {
            opponent.battlefield.splice(tIdx, 1);
            opponent.discard_pile.push(targetToDiscard);
            this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} forced ${opponent.name} to discard ${targetToDiscard.name} in play (Keyword: Discard x card in play).`);
            return { success: true, message: `Forced ${opponent.name} to discard ${targetToDiscard.name} from play.` };
          }
        }
        let discardedCount = 0;
        const droppedNames: string[] = [];
        for (let i = 0; i < count && opponent.battlefield.length > 0; i++) {
          const dropped = opponent.battlefield.pop()!;
          opponent.discard_pile.push(dropped);
          droppedNames.push(dropped.name);
          discardedCount++;
        }
        this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} forced ${opponent.name} to discard ${discardedCount} card(s) in play [${droppedNames.join(', ')}] (Keyword: Discard x card in play).`);
        return { success: true, message: `Discarded ${discardedCount} card(s) from play.` };
      }

      if (effect.type === 'buff_stat') {
        const target = action.targetCard || card;
        const amt = effect.amount || 1;
        if (effect.stat === 'off') {
          target.tempOffenseBuff = (target.tempOffenseBuff || 0) + amt;
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} granted +${amt} Offense to ${target.name}.`);
          return { success: true, message: `Granted +${amt} Offense to ${target.name}.` };
        } else {
          target.tempDefenseBuff = (target.tempDefenseBuff || 0) + amt;
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} granted +${amt} Defense to ${target.name}.`);
          return { success: true, message: `Granted +${amt} Defense to ${target.name}.` };
        }
      }

      if (effect.type === 'grant_token') {
        const target = action.targetCard || card;
        const amt = effect.amount || 1;
        const tokenType = effect.tokenType || (effect.stat === 'both' ? 'tech' : 'skill');

        if (tokenType === 'tech') {
          if ((target.techTokens || 0) > 0) {
            return { success: false, message: `${target.name} already has a Tech token (Stacking same token is not allowed).` };
          }
          target.techTokens = (target.techTokens || 0) + amt;
          target.appliedTokens = [...(target.appliedTokens || []), 'tech'];
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed +${amt}/+${amt} Tech token on ${target.name} (Total Tech: +${target.techTokens}/+${target.techTokens}).`);
          return { success: true, message: `Placed +${amt}/+${amt} Tech token on ${target.name}.` };
        }

        if (tokenType === 'weapon') {
          if ((target.weaponTokens || 0) > 0) {
            return { success: false, message: `${target.name} already has a Weapon token (Stacking same token is not allowed).` };
          }
          target.weaponTokens = (target.weaponTokens || 0) + amt;
          target.appliedTokens = [...(target.appliedTokens || []), 'weapon'];
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed +${amt}/+${amt} Weapon token on ${target.name}.`);
          return { success: true, message: `Placed +${amt}/+${amt} Weapon token on ${target.name}.` };
        }

        if (tokenType === 'suit') {
          if ((target.suitTokens || 0) > 0) {
            return { success: false, message: `${target.name} already has a Suit token (Stacking same token is not allowed).` };
          }
          target.suitTokens = (target.suitTokens || 0) + amt;
          target.appliedTokens = [...(target.appliedTokens || []), 'suit'];
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed +${amt}/+${amt} Suit token on ${target.name}.`);
          return { success: true, message: `Placed +${amt}/+${amt} Suit token on ${target.name}.` };
        }

        if (tokenType === 'powered_armor') {
          if ((target.poweredArmorTokens || 0) > 0) {
            return { success: false, message: `${target.name} already has a Powered armor token (Stacking same token is not allowed).` };
          }
          target.poweredArmorTokens = (target.poweredArmorTokens || 0) + amt;
          target.appliedTokens = [...(target.appliedTokens || []), 'powered_armor'];
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed +${amt}/+${amt} Powered armor token on ${target.name}.`);
          return { success: true, message: `Placed +${amt}/+${amt} Powered armor token on ${target.name}.` };
        }

        if (tokenType === 'power_suit') {
          if ((target.powerSuitTokens || 0) > 0) {
            return { success: false, message: `${target.name} already has a Power Suit token (Stacking same token is not allowed).` };
          }
          target.powerSuitTokens = (target.powerSuitTokens || 0) + amt;
          target.appliedTokens = [...(target.appliedTokens || []), 'power_suit'];
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed +${amt}/+${amt} Power Suit token on ${target.name}.`);
          return { success: true, message: `Placed +${amt}/+${amt} Power Suit token on ${target.name}.` };
        }

        if (tokenType === 'discard') {
          if (target.discardToken) {
            return { success: false, message: `${target.name} already has a Discard token (Stacking same token is not allowed).` };
          }
          target.discardToken = true;
          target.appliedTokens = [...(target.appliedTokens || []), 'discard'];
          this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed Discard token on ${target.name}. Card will be discarded at end of player's turn.`);
          return { success: true, message: `Placed Discard token on ${target.name}.` };
        }

        const sk = (effect.skill || 'ass') as 'ass' | 'raid' | 'sub';
        if ((target[sk] || 0) > 0) {
          return { success: false, message: `${target.name} already has ${sk.toUpperCase()} skill (Cannot place duplicate skill token).` };
        }
        target[sk] = (target[sk] || 0) + amt;
        target.appliedTokens = [...(target.appliedTokens || []), `skill_${sk}`];
        this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed +${amt} ${sk.toUpperCase()} token on ${target.name}.`);
        return { success: true, message: `Placed +${amt} ${sk.toUpperCase()} token on ${target.name}.` };
      }

      if (effect.type === 'exhaust_card') {
        const target = action.targetCard || opponent.battlefield.find(c => c.id === action.targetId);
        if (!target) {
          return { success: false, message: 'No target card found to exhaust.' };
        }
        target.exhausted = true;
        this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} placed ${target.name} into Exhaust condition (Keyword: Exhaust).`);
        return { success: true, message: `Exhausted opponent's ${target.name}.` };
      }

      if (effect.type === 'spawn_token') {
        const tokenExh = this.config.operativeSummonState === 'E';
        const token: Card = {
          id: `token_${Date.now()}`,
          name: effect.tokenName || 'Operative Token',
          type: 'Operative',
          cost: 0,
          off: effect.tokenOff || 1,
          def: effect.tokenDef || 1,
          ass: 0,
          raid: 0,
          sub: 0,
          production: 0,
          isToken: true,
          exhausted: tokenExh
        };
        player.battlefield.push(token);
        this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} deployed ${token.name} (${token.off}/${token.def}) ${tokenExh ? '(E)' : '(R)'}.`);
        return { success: true, message: `Deployed ${token.name}.` };
      }

      if (effect.type === 'produce_coins' || effect.type === 'gain_resource') {
        const amt = effect.amount || 1;
        player.current_turn_coins += amt;
        this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} gained +${amt} spendable resource(s).`);
        return { success: true, message: `Gained +${amt} spendable resource(s).` };
      }

      if (effect.type === 'gain_resource_discard_cost') {
        let handCard = action.targetCard || player.hand.find(c => c.id === action.targetId);
        if (!handCard && player.hand.length > 0) {
          handCard = player.hand[0];
        }
        if (!handCard) {
          return { success: false, message: 'No card available in hand to discard.' };
        }

        const handIdx = player.hand.findIndex(c => c.id === handCard!.id);
        if (handIdx !== -1) {
          player.hand.splice(handIdx, 1);
        }
        player.discard_pile.push(handCard);

        const gainedResources = handCard.cost || 0;
        player.current_turn_coins += gainedResources;

        this.log(player.pid, 'DYNAMIC-ABILITY', `${card.name} discarded ${handCard.name} (Cost: ${handCard.cost}) from hand, gaining +${gainedResources} spendable resource(s).`);
        return { 
          success: true, 
          message: `Discarded ${handCard.name} (Cost: ${handCard.cost}) and gained +${gainedResources} spendable resource(s).` 
        };
      }

      if (effect.type === 'deploy_card') {
        const cardToDeploy = action.targetCard || player.hand.find(c => c.id === action.targetId);
        if (!cardToDeploy) {
          return { success: false, message: 'No card selected from hand to deploy.' };
        }
        const deployRes = this.deployCardFromHandFree(player, opponent, cardToDeploy, card);
        if (deployRes.success) {
          const totalCount = effect.deployCount || effect.amount || 1;
          if (totalCount > 1) {
            const remaining = totalCount - 1;
            const reqType = effect.deployCardType || 'any';
            const stillHasMatching = player.hand.some(c => reqType === 'any' || c.type === reqType);
            if (stillHasMatching) {
              player.pendingFreeDeploys = {
                count: remaining,
                cardType: reqType,
                sourceCardName: card.name
              };
              this.log(player.pid, 'FREE-DEPLOY', `${remaining} free deploy(s) remaining for ${player.name} from ${card.name}.`);
            }
          }
        }
        return deployRes;
      }

      return { success: true, message: `Ability resolved successfully.` };
    }

    if (action.type === 'PLAY_CARD') {
      const card = action.card!;
      const cost = this.getCardDeployCost(player, card);
      const discount = this.getCardDeployDiscount(player, card);

      if (!this.spendCoins(player, cost)) {
        return { success: false, message: 'Not enough coins to play card.' };
      }

      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx !== -1) player.hand.splice(idx, 1);

      player.telemetry.cardsPlayedThisTurn++;
      this.recordCardPlayed(card);

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
        this.log(player.pid, 'PLAY-LOC', `Deployed Location: ${card.name} (Cost: ${cost}${discount > 0 ? ` [Base: ${card.cost}, Discount: -${discount}]` : ''}) ${locExh ? '(E)' : '(R)'}.`);
        return { success: true, message: `Deployed ${card.name}.` };
      }

      if (card.type === 'Operative') {
        const opExh = this.config.operativeSummonState === 'E';
        const inst: Card = { ...card, exhausted: opExh };
        player.battlefield.push(inst);
        this.log(player.pid, 'PLAY-OP', `Deployed Operative: ${card.name} (Cost: ${cost}${discount > 0 ? ` [Base: ${card.cost}, Discount: -${discount}]` : ''}) [Off:${card.off}/Def:${card.def}] ${opExh ? '(E)' : '(R)'}.`);

        // Ghost / ghost_siphon_2: Siphons 2 resources upon deployment
        if (card.name === 'Ghost' || card.specialAbility === 'ghost_siphon_2') {
          const stolen = Math.min(this.getTotalSpendableCoins(opponent), 2);
          if (stolen > 0) {
            this.spendCoins(opponent, stolen);
            player.current_turn_coins += stolen;
            player.telemetry.raidedCoinsThisTurn += stolen;
            this.log(player.pid, 'GHOST-SIPHON', `${card.name} triggered deployment siphon! Stole ${stolen} resources from ${opponent.name}.`);
            this.placeMissionTokens(player, 'res_theft', stolen);
          }
        }
        return { success: true, message: `Deployed ${card.name}.` };
      }

      if (card.specialAbility === 'assemble_strike_defense') {
        if (card.type === 'Support') {
          player.discard_pile.push(card);
        } else {
          const opExh = this.config.operativeSummonState === 'E';
          player.battlefield.push({ ...card, exhausted: opExh });
        }

        const friendlyOps = player.battlefield.filter(c => c.type === 'Operative');
        if (action.subChoice === 'assemble_defense') {
          if (friendlyOps.length > 0) {
            friendlyOps[0].tempDefenseBuff = (friendlyOps[0].tempDefenseBuff || 0) + 2;
            this.log(player.pid, 'ASSEMBLE', `Assembled Defense Team! +2 Defense token placed on ${friendlyOps[0].name}.`);
          } else {
            const defToken: Card = {
              id: `token_def_${Date.now()}`,
              name: 'Defense Team Token',
              type: 'Operative',
              cost: 0,
              off: 1,
              def: 3,
              ass: 0,
              raid: 0,
              sub: 0,
              production: 0,
              exhausted: this.config.operativeSummonState === 'E',
              tempDefenseBuff: 2
            };
            player.battlefield.push(defToken);
            this.log(player.pid, 'ASSEMBLE', `Assembled Defense Team! Deployed Defense Team Token (+2 Defense).`);
          }
          return { success: true, message: `Assembled Defense Team (+2 Defense).` };
        } else {
          if (friendlyOps.length > 0) {
            friendlyOps[0].tempOffenseBuff = (friendlyOps[0].tempOffenseBuff || 0) + 2;
            this.log(player.pid, 'ASSEMBLE', `Assembled Strike Team! +2 Offense token placed on ${friendlyOps[0].name}.`);
          } else {
            const strikeToken: Card = {
              id: `token_strike_${Date.now()}`,
              name: 'Strike Team Token',
              type: 'Operative',
              cost: 0,
              off: 3,
              def: 1,
              ass: 0,
              raid: 0,
              sub: 0,
              production: 0,
              exhausted: this.config.operativeSummonState === 'E',
              tempOffenseBuff: 2
            };
            player.battlefield.push(strikeToken);
            this.log(player.pid, 'ASSEMBLE', `Assembled Strike Team! Deployed Strike Team Token (+2 Offense).`);
          }
          return { success: true, message: `Assembled Strike Team (+2 Offense).` };
        }
      }

      if (card.type === 'Support') {
        player.discard_pile.push(card);
        this.log(player.pid, 'CAST-SUPPORT', `Cast Support: ${card.name} (Cost: ${cost}).`);
        this.resolveSupportSpell(player, opponent, card.name);

        if (card.abilityText || card.specialAbility) {
          const parsed = AbilityParserService.getInstance().parseAbility(card.abilityText || card.specialAbility);
          const deployEff = parsed.effects.find(e => e.type === 'deploy_card');
          if (deployEff) {
            const reqType = deployEff.deployCardType || 'any';
            const totalCount = deployEff.deployCount || deployEff.amount || 1;
            const matchingHand = player.hand.filter(c => reqType === 'any' || c.type === reqType);
            if (matchingHand.length > 0) {
              player.pendingFreeDeploys = {
                count: totalCount,
                cardType: reqType,
                sourceCardName: card.name
              };
              this.log(player.pid, 'FREE-DEPLOY', `${card.name} activated: Choose up to ${totalCount} ${reqType === 'any' ? '' : reqType + ' '}card(s) to deploy for FREE.`);
            }
          }
        }

        return { success: true, message: `Cast ${card.name}.` };
      }
    }

    if (action.type === 'DAN_WEAK_SACRIFICE') {
      const op = action.card!;
      const isGeneric = op.specialAbility === 'sacrifice_discard_hand_or_field';
      const threatType = action.subChoice === 'discard_hand' ? 'sub' : 'ass';
      const incomingAttack = (op.off || 4) + this.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (threatType === 'ass' ? (op.ass || 2) : (op.sub || 2)); // 6
      const defRes = this.resolveDefense(opponent, threatType, incomingAttack, defenderCardIds || action.defenderCardIds, bonusDefense);

      // Card is sacrificed from play regardless
      const idx = player.battlefield.findIndex(c => c.id === op.id);
      if (idx !== -1) {
        player.battlefield.splice(idx, 1);
        player.discard_pile.push(op);
      }

      if (defRes.thwarted) {
        this.log(opponent.pid, threatType === 'ass' ? 'THWART-ASS' : 'THWART-SUB', `🛡️ DEFENSIVE TEAM! ${defRes.message} teamed up against ${op.name}'s Attack (ATK: ${incomingAttack})! Attack THWARTED!`);
        this.placeMissionTokens(opponent, threatType === 'ass' ? 'thwart_ass' : 'thwart_sub', 1);
        return { success: true, thwarted: true, message: `${op.name} attack thwarted by ${defRes.message}!`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
      }

      if (action.subChoice === 'discard_hand') {
        const effectiveSub = isGeneric ? 1 : Math.max(0, incomingAttack - defRes.totalDef);
        const count = Math.min(opponent.hand.length, isGeneric ? 1 : effectiveSub);
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
          this.log(player.pid, 'SACRIFICE', `Sacrificed ${op.name}! Defenders (DEF: ${defRes.totalDef}) intercepted, but forced ${opponent.name} to discard ${count} card(s): [${dropped.join(', ')}].`);
        } else {
          this.log(player.pid, 'SACRIFICE', `Sacrificed ${op.name}! Forced ${opponent.name} to discard ${count} card(s) from hand: [${dropped.join(', ')}].`);
        }
        if (opponent.hand.length === 0 && count > 0) {
          this.placeMissionTokens(player, 'hand_wipe', 1);
        }
        return { success: true, message: `${op.name} forced ${opponent.name} to discard ${count} card(s).`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
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
        this.log(player.pid, 'SACRIFICE', `Sacrificed ${op.name}! Discarded ${removed.length} card(s) from ${opponent.name}'s battlefield: [${removed.join(', ')}].`);
        return { success: true, message: `${op.name} eliminated ${removed.length} card(s): ${removed.join(', ')}.`, defendersUsed: defRes.defenders, totalDef: defRes.totalDef };
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
        const atk = (op.off || 4) + this.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.ass || 3); // Boksoon ATK
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
        const atk = (op.off || 3) + this.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.sub || 3); // Mata Hari ATK
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
        const atk = (op.off || 3) + this.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.raid || 3); // Ghost ATK
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
          atk += (a.off || 1) + this.getCardStatTokensBuff(a) + (a.ass || 0) + (a.tempOffenseBuff || 0);
        }
        const attackerNames = attackers.map(a => a.name).join(' + ');

        // DEFENSIVE TEAM ASSIGNMENT (Rule 2)
        const defRes = this.resolveDefense(opponent, 'ass', atk, defenderCardIds || action.defenderCardIds, bonusDefense);

        // Calculate target's innate defense if target was not already one of the active defending operatives
        const isExh = target.exhausted;
        const targetAlreadyInDefenders = defRes.defenders.some(d => d.id === target.id);
        const targetInnateDef = targetAlreadyInDefenders ? 0 : ((target.def || 1) + this.getCardStatTokensBuff(target) + (isExh ? 0 : (target.ass || 0)) + (target.tempDefenseBuff || 0));
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
          totalRaidOff += (a.off || 1) + this.getCardStatTokensBuff(a) + (a.raid || 0) + (a.tempOffenseBuff || 0);
          totalRaidSkill += (a.raid || 0);
        }
        const attackerNames = attackers.map(a => a.name).join(' + ');

        // DEFENSIVE TEAM ASSIGNMENT (Rule 2)
        const defRes = this.resolveDefense(opponent, 'raid', totalRaidOff, defenderCardIds || action.defenderCardIds, bonusDefense);
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
          totalSubOff += (a.off || 1) + this.getCardStatTokensBuff(a) + (a.sub || 0) + (a.tempOffenseBuff || 0);
          totalSubSkill += (a.sub || 0);
        }
        const attackerNames = attackers.map(a => a.name).join(' + ');

        // DEFENSIVE TEAM ASSIGNMENT (Rule 2)
        const defRes = this.resolveDefense(opponent, 'sub', totalSubOff, defenderCardIds || action.defenderCardIds, bonusDefense);
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

    if (action.type === 'INTERRUPT_ACTION') {
      const card = action.card || player.hand.find(c => c.id === action.cardId) || player.battlefield.find(c => c.id === action.cardId);
      if (!card) return { success: false, message: 'Interrupt card not found.' };

      const inHandIdx = player.hand.findIndex(c => c.id === card.id);
      if (inHandIdx !== -1) {
        // Playing from hand out of turn
        const cost = card.cost || 0;
        if (player.current_turn_coins < cost) {
          return { success: false, message: `Not enough coins to play Interrupt (Requires ${cost}).` };
        }
        player.current_turn_coins -= cost;
        player.hand.splice(inHandIdx, 1);

        if (card.type === 'Support') {
          player.discard_pile.push(card);
          this.log(player.pid, 'INTERRUPT', `⚡ Played Interrupt Support: ${card.name} out-of-turn!`);
          if (action.dynamicAbilityEffect) {
            return this.executeAction(player, opponent, { ...action, type: 'DYNAMIC_ABILITY' });
          }
          return { success: true, message: `Played Interrupt ${card.name} out-of-turn.` };
        } else {
          card.exhausted = this.config.operativeSummonState === 'E';
          player.battlefield.push(card);
          this.log(player.pid, 'INTERRUPT', `⚡ Deployed Interrupt ${card.name} (${card.type}) out-of-turn!`);
          return { success: true, message: `Deployed Interrupt ${card.name} out-of-turn.` };
        }
      } else {
        // Triggering from battlefield
        return this.executeAction(player, opponent, { ...action, type: 'DYNAMIC_ABILITY' });
      }
    }

    return { success: false, message: 'Action could not be executed.' };
  }

  /**
   * Retrieves all available Interrupt actions for a player that can be played anytime, out-of-turn
   */
  getInterruptActions(player: Player, opponent: Player): Action[] {
    const actions: Action[] = [];

    // 1. Cards in hand with Interrupt keyword
    for (const card of player.hand) {
      let isInterrupt = card.isInterrupt;
      if (!isInterrupt && (card.abilityText || card.specialAbility)) {
        const parsed = AbilityParserService.getInstance().parseAbility(card.abilityText || card.specialAbility || '');
        if (parsed.isInterrupt || parsed.trigger === 'interrupt') {
          isInterrupt = true;
        }
      }

      if (isInterrupt) {
        const hasCoins = player.current_turn_coins >= (card.cost || 0);
        const costReason = !hasCoins ? `Requires ${card.cost} coins (You have ${player.current_turn_coins})` : undefined;

        if (card.type === 'Support') {
          const parsed = (card.abilityText || card.specialAbility) ? AbilityParserService.getInstance().parseAbility(card.abilityText || card.specialAbility || '') : null;
          if (parsed && parsed.effects.length > 0) {
            const dyn = this.generateDynamicActionsForCard(card, player, opponent);
            for (const act of dyn) {
              actions.push({
                ...act,
                type: 'INTERRUPT_ACTION',
                desc: `⚡ Interrupt from Hand: ${act.desc}`
              });
            }
          } else {
            actions.push({
              type: 'INTERRUPT_ACTION',
              cardId: card.id,
              cardName: card.name,
              card,
              disabled: !hasCoins,
              disabledReason: costReason,
              desc: `⚡ Interrupt from Hand: Play ${card.name} (${card.cost} coins)`
            });
          }
        } else {
          actions.push({
            type: 'INTERRUPT_ACTION',
            cardId: card.id,
            cardName: card.name,
            card,
            disabled: !hasCoins,
            disabledReason: costReason,
            desc: `⚡ Interrupt Deploy: Deploy ${card.name} out-of-turn (${card.type}, ${card.cost} coins)`
          });
        }
      }
    }

    // 2. Cards on battlefield with Interrupt keyword
    for (const card of player.battlefield) {
      let isInterrupt = card.isInterrupt;
      if (!isInterrupt && (card.abilityText || card.specialAbility)) {
        const parsed = AbilityParserService.getInstance().parseAbility(card.abilityText || card.specialAbility || '');
        if (parsed.isInterrupt || parsed.trigger === 'interrupt') {
          isInterrupt = true;
        }
      }

      if (isInterrupt) {
        const dyn = this.generateDynamicActionsForCard(card, player, opponent);
        for (const act of dyn) {
          actions.push({
            ...act,
            type: 'INTERRUPT_ACTION',
            desc: `⚡ Interrupt: ${act.desc}`
          });
        }
      }
    }

    return actions;
  }

  // ==========================================
  // STAT TOKENS SYSTEM
  // Calculates combined stat bonus from Tech, Weapon, Suit, Powered Armor, Power Suit tokens
  // ==========================================
  public getCardStatTokensBuff(card: Card): number {
    return (card.techTokens || 0) + (card.weaponTokens || 0) + (card.suitTokens || 0) + (card.poweredArmorTokens || 0) + (card.powerSuitTokens || 0);
  }

  // ==========================================
  // DEFENSIVE TEAM SYSTEM (Rule 2)
  // Calculates individual operative defense contribution:
  // Base DEF + TempBuff + 1 point for each applicable Skill rating
  // ==========================================
  calculateOperativeDefense(card: Card, threatType: 'ass' | 'sub' | 'raid'): { baseDef: number; tempBuff: number; skillBonus: number; totalDef: number } {
    const baseDef = card.def || 1;
    const tempBuff = (card.tempDefenseBuff || 0) + this.getCardStatTokensBuff(card);
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
    defenderCardIds?: string[],
    bonusDefense: number = 0
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

    if (assigned.length === 0 && bonusDefense <= 0) {
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

    if (bonusDefense > 0) {
      totalDef += bonusDefense;
      parts.push(`Support/Defense Bonus (+${bonusDefense})`);
    }

    const thwarted = totalDef >= incomingAttack;
    return {
      defenders: assigned,
      totalDef,
      thwarted,
      message: `${assigned.length > 0 ? assigned.map(d => d.name).join(' + ') : 'Defensive Reactions'} (Total DEF: ${totalDef}) [${parts.join(', ')}]`
    };
  }

  // Plays a defensive support reaction card out of turn when player is defending
  playDefensiveReactionCard(
    defender: Player,
    cardId: string,
    subChoice?: 'assemble_defense' | 'assemble_strike'
  ): { success: boolean; defBonus: number; message: string } {
    const cardIdx = defender.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      return { success: false, defBonus: 0, message: 'Card not found in hand.' };
    }
    const card = defender.hand[cardIdx];
    const parsed = AbilityParserService.getInstance().parseAbility(card.abilityText);
    const isReaction = card.canPlayOnDefense || card.type === 'Support' || card.specialAbility === 'assemble_strike_defense' || parsed.canPlayOnDefense || card.isIntercept || card.isInterrupt || parsed.isIntercept || parsed.isInterrupt;

    if (!isReaction) {
      return { success: false, defBonus: 0, message: 'Card cannot be played out of turn on defense.' };
    }

    defender.hand.splice(cardIdx, 1);
    defender.discard_pile.push(card);

    let defBonus = 0;
    if (card.specialAbility === 'assemble_strike_defense') {
      const readyOps = defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
      if (subChoice === 'assemble_strike') {
        if (readyOps.length > 0) {
          readyOps[0].tempOffenseBuff = (readyOps[0].tempOffenseBuff || 0) + 2;
        }
        defBonus = 1;
        this.log(defender.pid, 'DEF-REACTION', `Played ${card.name} out of turn! Assembled Strike Team (+2 Offense, +1 Intercept DEF).`);
      } else {
        if (readyOps.length > 0) {
          readyOps[0].tempDefenseBuff = (readyOps[0].tempDefenseBuff || 0) + 2;
        }
        defBonus = 2;
        this.log(defender.pid, 'DEF-REACTION', `Played ${card.name} out of turn! Assembled Defense Team (+2 DEF to intercept!).`);
      }
    } else {
      const interceptEff = parsed.effects.find(e => e.type === 'intercept_defense' || (e.type === 'buff_stat' && e.stat === 'def'));
      if (interceptEff && interceptEff.amount) {
        defBonus = interceptEff.amount;
      } else {
        defBonus = card.def || 2;
      }
      this.log(defender.pid, 'DEF-REACTION', `Played ${card.name} out of turn as defensive reaction (+${defBonus} DEF)!`);
    }

    return {
      success: true,
      defBonus,
      message: `Played ${card.name} out of turn: +${defBonus} Defense bonus granted!`
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

