export type CardType = 'Affiliation' | 'Location' | 'Operative' | 'Support' | 'Mission';

export type EntryState = 'R' | 'E'; // Ready or Exhausted

export interface Card {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  qty?: number;
  // Economics
  production?: number;
  cap?: number;
  stored_coins?: number;
  exhausted?: boolean;
  // Combat & Skills
  off?: number;
  def?: number;
  ass?: number;
  raid?: number;
  sub?: number;
  // Modifiers
  tempOffenseBuff?: number;
  tempDefenseBuff?: number;
  // Abilities
  specialAbility?: string;
  abilityText?: string;
  canPlayOnDefense?: boolean;
  // Mission specific fields
  points?: number;
  req?: number;
  missionType?: string;
  // Meta
  isToken?: boolean;
  isNamed?: boolean;
  isOriginal?: boolean;
  isModifiedOriginal?: boolean;
  parentCardId?: string;
  version?: number;
}

export interface Mission {
  id: string;
  name: string;
  type: string; // 'res_theft' | 'kills' | 'hand_wipe' | 'thwart_raid' | 'thwart_ass' | 'thwart_sub' | 'no_ops' | 'ops_in_turn' | 'empty_hand' | 'play_named'
  req: number;
  points: number;
  tokens: Record<string, number>; // pid -> count
  description: string;
  isOriginal?: boolean;
  isModifiedOriginal?: boolean;
}

export interface TurnTelemetry {
  eliminatedEnemyOpThisTurn: boolean;
  raidedCoinsThisTurn: number;
  discardedCardFromHandThisTurn: boolean;
  operationsConductedThisTurn: number;
  playedNamedThisTurn: boolean;
  uniqueOpTypesThisTurn: Set<string>;
  cardsPlayedThisTurn: number;
}

export interface Player {
  id: string;
  pid: 'P1' | 'P2';
  name: string;
  isAI: boolean;
  affiliation: Card | null;
  current_turn_coins: number;
  hand: Card[];
  battlefield: Card[];
  discard_pile: Card[];
  completed_missions: Mission[];
  mission_points: number;
  telemetry: TurnTelemetry;
}

export type TurnPhase = 'DRAW' | 'OPERATIONS' | 'CLEANUP';

export type ActionType = 
  | 'TAP_PROD'
  | 'TAP_ABILITY'
  | 'PLAY_CARD'
  | 'OPERATIVE_ACTION'
  | 'DAN_WEAK_SACRIFICE'
  | 'INTERCEPT_THWART'
  | 'DISCARD_CARD'
  | 'ADVANCE_PHASE'
  | 'PASS';

export interface Action {
  type: ActionType;
  cardId?: string;
  cardName?: string;
  card?: Card;
  attackerCards?: Card[];
  defenderCardIds?: string[];
  defenderCards?: Card[];
  targetId?: string;
  targetName?: string;
  targetCard?: Card;
  opType?: 'ass' | 'raid' | 'sub' | 'hold' | 'boksoon_ass' | 'mata_hari_steal' | 'ghost_siphon';
  subChoice?: 'discard_hand' | 'discard_in_play' | 'buff_off' | 'buff_def' | 'buff_ass' | 'buff_raid' | 'buff_sub' | 'assemble_strike' | 'assemble_defense';
  desc: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface LogEntry {
  id: string;
  round: number;
  actionNumber: number;
  pid: 'P1' | 'P2';
  code: string;
  details: string;
  balanceStr: string;
  timestamp: number;
}

export type GameMode = 'human_vs_ai' | 'ai_vs_ai' | 'pass_and_play' | 'online_multiplayer';

export interface RoomDefenseData {
  attackerPid: 'P1' | 'P2';
  defenderPid: 'P1' | 'P2';
  action: Action;
  threatType: 'ass' | 'sub' | 'raid';
  threatName: string;
  incomingAttack: number;
  attackerNames: string;
  readyOpIds: string[];
  selectedDefenderIds: string[];
}

export interface MultiplayerRoomDoc {
  roomId: string;
  status: 'waiting' | 'playing' | 'ended';
  hostUid: string;
  hostName: string;
  guestUid: string;
  guestName: string;
  currentRound: number;
  activePlayerIndex: number;
  currentPhase: string;
  actionCounter: number;
  gameOver: boolean;
  winner: string;
  winReason: string;
  engineState: any;
  pendingDefense?: RoomDefenseData | null;
  lastActionText?: string;
  createdAt: string;
  updatedAt: string;
}

