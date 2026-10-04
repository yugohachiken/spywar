import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SpywarEngine, DEFAULT_CONFIG } from '../engine/SpywarEngine';
import { ISMCTSAgent } from '../engine/ISMCTSAgent';
import { CardView } from './CardView';
import { Action, Card, GameMode, Player, MultiplayerRoomDoc, RoomDefenseData } from '../types/spywar';
import { Play, RotateCcw, Bot, Shield, Coins, Sparkles, ChevronRight, Activity, User, Users, Pause, Download, SlidersHorizontal, Check, AlertTriangle, Globe, Copy, Link as LinkIcon, Loader2, LogOut, ZoomIn, Layers, Zap, Target, Sword, Plus, Minus, Brain } from 'lucide-react';
import { MultiplayerLobbyModal } from './MultiplayerLobbyModal';
import { CombatPlanner, CombatOperationType } from './CombatPlanner';
import { InlineDefensePanel } from './InlineDefensePanel';
import { subscribeToMultiplayerRoom, syncRoomState, deleteMultiplayerRoom } from '../services/multiplayerService';
import { useCardZoom } from '../context/CardZoomContext';
import { CardDatabaseService } from '../services/cardDatabaseService';
import { AbilityParserService } from '../services/abilityParserService';

export interface AiDifficultyConfig {
  level: number;
  name: string;
  shortName: string;
  emoji: string;
  iterations: number;
  shortDescription: string;
  description: string;
  colorClass: string;
}

export const AI_DIFFICULTY_LEVELS: AiDifficultyConfig[] = [
  {
    level: 1,
    name: 'Novice',
    shortName: 'Novice',
    emoji: '🌱',
    iterations: 15,
    shortDescription: 'Basic casual play',
    description: '15 MCTS branches. Quick, shallow lookahead, prone to tactical blunders and missed synergies.',
    colorClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
  },
  {
    level: 2,
    name: 'Apprentice',
    shortName: 'Apprentice',
    emoji: '🎯',
    iterations: 30,
    shortDescription: 'Light tactical search',
    description: '30 MCTS branches. Basic short-term planning and simple attack combos.',
    colorClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
  },
  {
    level: 3,
    name: 'Cadet',
    shortName: 'Cadet',
    emoji: '🕵️',
    iterations: 50,
    shortDescription: 'Steady tactical awareness',
    description: '50 MCTS branches. Casual play with steady resource development and defensive awareness.',
    colorClass: 'bg-teal-950/70 text-teal-300 border-teal-600/50'
  },
  {
    level: 4,
    name: 'Operative',
    shortName: 'Operative',
    emoji: '💼',
    iterations: 80,
    shortDescription: 'Balanced field tactics',
    description: '80 MCTS branches. Competent field agent with balanced raid, assassination, and defense tactics.',
    colorClass: 'bg-cyan-950/70 text-cyan-300 border-cyan-600/50'
  },
  {
    level: 5,
    name: 'Veteran',
    shortName: 'Veteran',
    emoji: '🎖️',
    iterations: 120,
    shortDescription: 'Multi-turn coordination',
    description: '120 MCTS branches (Default). Solid multi-turn planning, crew synergies, and target prioritization.',
    colorClass: 'bg-blue-950/70 text-blue-300 border-blue-500/60'
  },
  {
    level: 6,
    name: 'Commander',
    shortName: 'Commander',
    emoji: '⚔️',
    iterations: 180,
    shortDescription: 'Deep tree rollouts',
    description: '180 MCTS branches. Deeper branch exploration anticipating player counters and interrupts.',
    colorClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/60'
  },
  {
    level: 7,
    name: 'Mastermind',
    shortName: 'Mastermind',
    emoji: '🧠',
    iterations: 260,
    shortDescription: 'High tactical depth',
    description: '260 MCTS branches. High-depth foresight targeting resource starvation, mission leads, and lethal strikes.',
    colorClass: 'bg-purple-950/80 text-purple-300 border-purple-500/70'
  },
  {
    level: 8,
    name: 'Grandmaster',
    shortName: 'Grandmaster',
    emoji: '👑',
    iterations: 380,
    shortDescription: 'Extensive tree search',
    description: '380 MCTS branches. Heavy branch exploration optimizing complex victory conditions and defense teams.',
    colorClass: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/70 shadow-sm'
  },
  {
    level: 9,
    name: 'Deep Spy',
    shortName: 'Deep Spy',
    emoji: '👁️',
    iterations: 520,
    shortDescription: 'Deep multi-ply lookahead',
    description: '520 MCTS branches. Deep tree rollout across multiple hidden-card determinizations for high winrates.',
    colorClass: 'bg-rose-950/90 text-rose-300 border-rose-500 shadow-sm'
  },
  {
    level: 10,
    name: 'Apex Engine',
    shortName: 'Apex',
    emoji: '⚡',
    iterations: 750,
    shortDescription: 'Maximum Monte Carlo depth',
    description: '750 MCTS branches. Maximum Monte Carlo branch depth for near-optimal espionage execution.',
    colorClass: 'bg-amber-950/95 text-amber-300 border-amber-400 shadow-md ring-1 ring-amber-400/30 animate-pulse'
  }
];

interface PendingDefenseState {
  attacker: Player;
  defender: Player;
  action: Action;
  threatType: 'ass' | 'sub' | 'raid';
  threatName: string;
  incomingAttack: number;
  attackerNames: string;
  readyOps: Card[];
  selectedDefenderIds: string[];
  isSpecialAbilityAttack?: boolean;
}

interface InterruptWindowState {
  defender: Player;
  attacker: Player;
  sourceCard: Card;
  suspendedDefense?: PendingDefenseState | null;
}

interface RecentOperationState {
  attackerPid: 'P1' | 'P2';
  defenderPid: 'P1' | 'P2';
  attackerCardIds: string[];
  defenderCardIds: string[];
  targetCardId?: string;
  operationType: string;
  description: string;
  timestamp: number;
}

interface PendingTargetSelectionState {
  sourceCard: Card;
  promptTitle: string;
  promptDescription: string;
  effectType?: 'skill_ass' | 'skill_raid' | 'skill_sub' | 'tech_token' | 'buff_off' | 'buff_def' | 'elimination' | 'conversion' | 'acquisition' | 'general';
  actions: Action[];
}

interface GameBoardProps {
  engine: SpywarEngine;
  onRefresh: () => void;
  onNavigateToDeckBuilder?: () => void;
  onNavigateToCardEditor?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ engine, onRefresh, onNavigateToDeckBuilder, onNavigateToCardEditor }) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pendingTargetSelection, setPendingTargetSelection] = useState<PendingTargetSelectionState | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<Card[]>([]);
  const [selectedCombatOp, setSelectedCombatOp] = useState<CombatOperationType | null>(null);
  const [selectedCombatTarget, setSelectedCombatTarget] = useState<Card | null>(null);
  const { setHighlightedItem, clearHighlightedItem, openZoom, highlightedItem } = useCardZoom();
  const [aiThinking, setAiThinking] = useState(false);
  const [autoAi, setAutoAi] = useState(true);
  const [gameMode, setGameMode] = useState<GameMode>('human_vs_ai');
  const [aiSpeed, setAiSpeed] = useState<number>(450); // ms delay between AI actions
  const [aiDifficulty, setAiDifficulty] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('spywar_ai_difficulty');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 1 && val <= 10) return val;
      }
    } catch {
      // fallback
    }
    return 5; // Default Level 5 (Veteran - 120 branches)
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingDefense, setPendingDefense] = useState<PendingDefenseState | null>(null);
  const [interruptWindowState, setInterruptWindowState] = useState<InterruptWindowState | null>(null);
  const [isGameStarted, setIsGameStarted] = useState(engine.currentRound > 0);
  const [recentOperation, setRecentOperation] = useState<RecentOperationState | null>(null);
  const autoAiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recentOpTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save active match state to session storage so reloads or code updates never cause a sudden reset
  useEffect(() => {
    if (!engine.gameOver && engine.currentRound > 0) {
      try {
        localStorage.setItem('spywar_active_match_session', JSON.stringify(engine.getSerializedState()));
      } catch (e) {
        // storage fallback
      }
    } else if (engine.gameOver) {
      localStorage.removeItem('spywar_active_match_session');
    }
  }, [engine.actionCounter, engine.currentRound, engine.gameOver, isGameStarted]);

  // Online Multiplayer State
  const [multiplayerRoom, setMultiplayerRoom] = useState<MultiplayerRoomDoc | null>(null);
  const [myPid, setMyPid] = useState<'P1' | 'P2'>('P1');
  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isOnline = gameMode === 'online_multiplayer';
  const activePlayer = engine.getActivePlayer();
  const opponent = engine.getOpponent();

  // In online multiplayer: bottom is always the local user, top is always opponent
  // In human vs AI: bottom is always Human (Player 1), top is always AI (Player 2)
  const bottomPlayer = isOnline
    ? (myPid === 'P2' ? engine.players[1] : engine.players[0])
    : gameMode === 'human_vs_ai'
    ? engine.players[0]
    : activePlayer;

  const topPlayer = isOnline
    ? (myPid === 'P2' ? engine.players[0] : engine.players[1])
    : gameMode === 'human_vs_ai'
    ? engine.players[1]
    : opponent;

  const isMyTurn = isOnline
    ? (activePlayer.pid === myPid && multiplayerRoom?.status === 'playing')
    : (isGameStarted && !activePlayer.isAI);

  const myPlayer = isOnline
    ? bottomPlayer
    : (gameMode === 'human_vs_ai' ? engine.players[0] : (activePlayer.isAI ? opponent : activePlayer));
  const otherPlayer = isOnline
    ? topPlayer
    : (gameMode === 'human_vs_ai' ? engine.players[1] : (activePlayer.isAI ? activePlayer : opponent));

  const interruptActions = engine.getInterruptActions(myPlayer, otherPlayer);

  const baseLegalActions = isOnline
    ? (isMyTurn ? engine.getLegalActions(bottomPlayer, topPlayer, selectedCard) : [])
    : engine.getLegalActions(activePlayer, opponent, selectedCard);

  const legalActions = isMyTurn
    ? [...baseLegalActions, ...interruptActions.filter(ia => !baseLegalActions.some(ba => ba.cardId === ia.cardId && ba.desc === ia.desc))]
    : [];

  const offTurnSpendable = engine.getTotalSpendableCoins(bottomPlayer);

  // Discover all cards with Interrupt special ability eligible for activation when player is on defense / off-turn
  // Requirements:
  // 1. In-play cards (battlefield/affiliation) must be in Ready condition (not exhausted) unless Passive
  // 2. Player must have enough spendable resources should the Interrupt have an activation cost
  // 3. Hand cards must have sufficient spendable coins to deploy/play
  const offTurnInterruptCandidates = useMemo(() => {
    const list: {
      card: Card;
      location: 'battlefield' | 'affiliation' | 'hand';
      cost: number;
      hasEnoughCoins: boolean;
      isReady: boolean;
      isPassive: boolean;
      parsedAbility: any;
      action?: Action;
    }[] = [];

    // Check Affiliation for Interrupt
    if (bottomPlayer.affiliation) {
      const aff = bottomPlayer.affiliation;
      const parsed = aff.abilityText ? AbilityParserService.getInstance().parseAbility(aff.abilityText) : null;
      const isInterrupt = aff.isInterrupt || parsed?.isInterrupt || parsed?.trigger === 'interrupt' || aff.abilityText?.toLowerCase().includes('interrupt');
      if (isInterrupt) {
        const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
        const isReady = !aff.exhausted || isPassive;
        const cost = parsed?.costCoins || 0;
        const cardAct = interruptActions.find(a => a.cardId === aff.id);
        list.push({
          card: aff,
          location: 'affiliation',
          cost,
          hasEnoughCoins: offTurnSpendable >= cost,
          isReady,
          isPassive,
          parsedAbility: parsed,
          action: cardAct
        });
      }
    }

    // Check Battlefield for Interrupt (Must be in Ready condition unless Passive)
    for (const c of bottomPlayer.battlefield) {
      const parsed = c.abilityText ? AbilityParserService.getInstance().parseAbility(c.abilityText) : null;
      const isInterrupt = c.isInterrupt || parsed?.isInterrupt || parsed?.trigger === 'interrupt' || c.abilityText?.toLowerCase().includes('interrupt');
      if (isInterrupt) {
        const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
        const isReady = !c.exhausted || isPassive;
        const cost = parsed?.costCoins || 0;
        const cardAct = interruptActions.find(a => a.cardId === c.id);
        list.push({
          card: c,
          location: 'battlefield',
          cost,
          hasEnoughCoins: offTurnSpendable >= cost,
          isReady,
          isPassive,
          parsedAbility: parsed,
          action: cardAct
        });
      }
    }

    // Check Hand for Interrupt
    for (const c of bottomPlayer.hand) {
      const parsed = c.abilityText ? AbilityParserService.getInstance().parseAbility(c.abilityText) : null;
      const isInterrupt = c.isInterrupt || parsed?.isInterrupt || parsed?.trigger === 'interrupt' || c.abilityText?.toLowerCase().includes('interrupt');
      if (isInterrupt) {
        const cost = (c.cost || 0) + (parsed?.costCoins || 0);
        const cardAct = interruptActions.find(a => a.cardId === c.id);
        list.push({
          card: c,
          location: 'hand',
          cost,
          hasEnoughCoins: offTurnSpendable >= cost,
          isReady: true,
          isPassive: parsed?.isPassive || false,
          parsedAbility: parsed,
          action: cardAct
        });
      }
    }

    return list;
  }, [bottomPlayer.affiliation, bottomPlayer.battlefield, bottomPlayer.hand, offTurnSpendable, interruptActions]);

  const currentDiffConfig = useMemo(() => {
    return AI_DIFFICULTY_LEVELS.find(l => l.level === aiDifficulty) || AI_DIFFICULTY_LEVELS[4];
  }, [aiDifficulty]);

  const mctsAgentRef = useRef(new ISMCTSAgent(currentDiffConfig.iterations));

  // Dynamically update MCTS agent branch iterations and rollout depth when difficulty changes
  useEffect(() => {
    if (mctsAgentRef.current) {
      mctsAgentRef.current.iterations = currentDiffConfig.iterations;
      mctsAgentRef.current.rolloutDepth = currentDiffConfig.level >= 8 ? 5 : currentDiffConfig.level <= 2 ? 2 : 4;
    }
  }, [currentDiffConfig]);

  // Auto-detect ?room=SPYxxx in URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInitialJoinCode(roomParam.trim().toUpperCase());
      setShowLobbyModal(true);
    }
  }, []);

  // Subscribe to real-time updates for online room
  useEffect(() => {
    if (gameMode !== 'online_multiplayer' || !multiplayerRoom?.roomId) return;

    const unsubscribe = subscribeToMultiplayerRoom(
      multiplayerRoom.roomId,
      (updatedRoom) => {
        setMultiplayerRoom(updatedRoom);
        if (updatedRoom.engineState) {
          engine.loadSerializedState(updatedRoom.engineState);
        }

        if (updatedRoom.pendingDefense) {
          const defData = updatedRoom.pendingDefense;
          const attacker = engine.players.find(p => p.pid === defData.attackerPid) || engine.players[0];
          const defender = engine.players.find(p => p.pid === defData.defenderPid) || engine.players[1];
          const readyOps = defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
          const recommended = engine.selectAiDefenders(defender, defData.threatType, defData.incomingAttack, defData.action.targetCard);

          setPendingDefense({
            attacker,
            defender,
            action: defData.action,
            threatType: defData.threatType,
            threatName: defData.threatName,
            incomingAttack: defData.incomingAttack,
            attackerNames: defData.attackerNames,
            readyOps,
            selectedDefenderIds: defData.selectedDefenderIds && defData.selectedDefenderIds.length > 0 
              ? defData.selectedDefenderIds 
              : recommended.map(c => c.id)
          });
        } else {
          setPendingDefense(null);
        }

        onRefresh();
      },
      (err) => {
        console.error('Multiplayer room sync error:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [gameMode, multiplayerRoom?.roomId]);

  // Synchronize engine AI status when game mode changes
  const handleModeChange = (mode: GameMode) => {
    if (mode === 'online_multiplayer') {
      if (!multiplayerRoom) {
        setShowLobbyModal(true);
        return;
      }
    } else {
      setMultiplayerRoom(null);
    }
    setGameMode(mode);
    engine.setGameMode(mode);
    const shouldAuto = mode === 'human_vs_ai' || mode === 'ai_vs_ai';
    setAutoAi(shouldAuto);
    if (autoAiTimerRef.current) {
      clearTimeout(autoAiTimerRef.current);
    }
    onRefresh();
  };

  const handleRoomJoined = (roomDoc: MultiplayerRoomDoc, pid: 'P1' | 'P2', _name: string) => {
    setMultiplayerRoom(roomDoc);
    setMyPid(pid);
    setGameMode('online_multiplayer');
    engine.setGameMode('online_multiplayer');
    if (roomDoc.engineState) {
      engine.loadSerializedState(roomDoc.engineState);
    }
    setShowLobbyModal(false);
    onRefresh();
  };

  const handleLeaveOnlineRoom = () => {
    setMultiplayerRoom(null);
    handleModeChange('human_vs_ai');
  };

  const handleCopyCode = () => {
    if (!multiplayerRoom) return;
    navigator.clipboard.writeText(multiplayerRoom.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!multiplayerRoom) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${multiplayerRoom.roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };


  // Keyboard shortcut listener: 's' key triggers Step AI (P2), leaving Spacebar for Card Magnification (Tabletopia mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 's' || e.key === 'S') {
        const cur = engine.getActivePlayer();
        if (cur.isAI && !engine.gameOver && !aiThinking) {
          e.preventDefault();
          handleManualTriggerAi();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiThinking, engine.gameOver, engine.activePlayerIndex]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoAiTimerRef.current) {
        clearTimeout(autoAiTimerRef.current);
      }
      if (recentOpTimerRef.current) {
        clearTimeout(recentOpTimerRef.current);
      }
    };
  }, []);

  // Auto-play watchdog effect
  useEffect(() => {
    if (isGameStarted && autoAi && !engine.gameOver && !aiThinking && !pendingDefense && !interruptWindowState) {
      const currentActive = engine.getActivePlayer();
      // In Human vs AI, auto-play only executes when active player is AI (P2)!
      // In AI vs AI, auto-play executes for both P1 and P2
      if (currentActive.isAI) {
        if (autoAiTimerRef.current) clearTimeout(autoAiTimerRef.current);
        autoAiTimerRef.current = setTimeout(() => {
          executeAiStep();
        }, aiSpeed);
      }
    }
    return () => {
      if (autoAiTimerRef.current) clearTimeout(autoAiTimerRef.current);
    };
  }, [isGameStarted, autoAi, engine.activePlayerIndex, engine.actionCounter, engine.gameOver, aiThinking, aiSpeed, pendingDefense, interruptWindowState]);

  const isAttackAction = (action: Action): boolean => {
    if (action.type === 'DAN_WEAK_SACRIFICE') return true;
    if (action.type === 'OPERATIVE_ACTION') {
      return ['ass', 'sub', 'raid', 'boksoon_ass', 'mata_hari_steal', 'ghost_siphon'].includes(action.opType || '');
    }
    if (action.type === 'DYNAMIC_ABILITY' && (
      action.dynamicAbilityEffect?.effect?.type === 'exhaust_card' ||
      action.dynamicAbilityEffect?.effect?.type === 'discard_field' ||
      action.dynamicAbilityEffect?.effect?.type === 'discard_hand' ||
      action.dynamicAbilityEffect?.effect?.type === 'siphon' ||
      action.isSpecialAbilityAttack
    )) {
      return true;
    }
    return false;
  };

  const canDefenderReactOrDefend = (defender: Player, isSpecialAbilityAttack: boolean): boolean => {
    // 1. Ready operatives
    const readyOps = defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
    if (!isSpecialAbilityAttack && readyOps.length > 0) return true;
    if (isSpecialAbilityAttack && readyOps.some(c => {
      const parsed = (c.abilityText || c.specialAbility) ? AbilityParserService.getInstance().parseAbility(c.abilityText || c.specialAbility) : null;
      return c.isIntercept || c.isInterrupt || c.discardAfterDefending || parsed?.isIntercept || parsed?.isInterrupt;
    })) return true;

    // 2. Affiliation with intercept/reaction
    if (defender.affiliation) {
      const aff = defender.affiliation;
      const parsed = aff.abilityText ? AbilityParserService.getInstance().parseAbility(aff.abilityText) : null;
      const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
      if (!aff.exhausted || isPassive) {
        if (aff.canPlayOnDefense || aff.isIntercept || aff.isInterrupt || aff.specialAbility === 'the_company_intercept' || aff.name.includes('The Company') || parsed?.isIntercept || parsed?.isInterrupt || parsed?.canPlayOnDefense || parsed?.trigger === 'intercept' || parsed?.trigger === 'reaction_defense') {
          return true;
        }
      }
    }

    // 3. In-play cards with intercept/reaction
    for (const c of defender.battlefield) {
      const parsed = c.abilityText ? AbilityParserService.getInstance().parseAbility(c.abilityText) : null;
      const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
      if (!c.exhausted || isPassive) {
        if (c.canPlayOnDefense || c.isIntercept || c.isInterrupt || parsed?.isIntercept || parsed?.isInterrupt || parsed?.canPlayOnDefense || parsed?.trigger === 'intercept' || parsed?.trigger === 'reaction_defense') {
          return true;
        }
      }
    }

    // 4. Cards in hand
    for (const c of defender.hand) {
      if (c.canPlayOnDefense || c.isIntercept || c.isInterrupt) return true;
      if (c.name.startsWith('Operative Crew') || c.specialAbility === 'operative_crew_intercept' || c.specialAbility === 'assemble_strike_defense') return true;
      if (c.abilityText) {
        const parsed = AbilityParserService.getInstance().parseAbility(c.abilityText);
        if (parsed.canPlayOnDefense || parsed.isIntercept || parsed.isInterrupt || parsed.trigger === 'intercept' || parsed.trigger === 'interrupt' || parsed.trigger === 'reaction_defense') return true;
      }
      if (!isSpecialAbilityAttack && c.type === 'Support') return true;
    }

    return false;
  };

  const getIncomingAttackInfo = (action: Action) => {
    const attackers = (action.attackerCards && action.attackerCards.length > 0) ? action.attackerCards : (action.card ? [action.card] : []);
    const attackerNames = attackers.map(a => a.name).join(' + ') || 'Attacker';
    const isSpecialAbilityAttack = action.isSpecialAbilityAttack || action.type === 'DAN_WEAK_SACRIFICE' || action.type === 'DYNAMIC_ABILITY' || ['boksoon_ass', 'mata_hari_steal', 'ghost_siphon'].includes(action.opType || '');

    if (action.type === 'DYNAMIC_ABILITY' && action.dynamicAbilityEffect?.effect?.type === 'exhaust_card') {
      const target = action.targetCard;
      const targetName = target ? target.name : 'Card';
      return {
        threatType: 'ass' as const,
        threatName: `Exhaust Special Ability on ${targetName}`,
        attackPower: 1,
        attackerNames: action.card?.name || 'Special Ability',
        isSpecialAbilityAttack: true
      };
    }

    if (action.type === 'DYNAMIC_ABILITY' && action.dynamicAbilityEffect?.effect?.type === 'discard_field') {
      return {
        threatType: 'ass' as const,
        threatName: `Discard Field Special Ability`,
        attackPower: action.dynamicAbilityEffect.effect.amount || 1,
        attackerNames: action.card?.name || 'Special Ability',
        isSpecialAbilityAttack: true
      };
    }

    if (action.type === 'DYNAMIC_ABILITY' && action.dynamicAbilityEffect?.effect?.type === 'discard_hand') {
      return {
        threatType: 'sub' as const,
        threatName: `Discard Hand Special Ability`,
        attackPower: action.dynamicAbilityEffect.effect.amount || 1,
        attackerNames: action.card?.name || 'Special Ability',
        isSpecialAbilityAttack: true
      };
    }

    if (action.type === 'DYNAMIC_ABILITY' && action.dynamicAbilityEffect?.effect?.type === 'siphon') {
      return {
        threatType: 'raid' as const,
        threatName: `Siphon Resource Special Ability`,
        attackPower: action.dynamicAbilityEffect.effect.amount || 2,
        attackerNames: action.card?.name || 'Special Ability',
        isSpecialAbilityAttack: true
      };
    }

    if (action.type === 'DAN_WEAK_SACRIFICE') {
      const threatType: 'ass' | 'sub' | 'raid' = action.subChoice === 'discard_hand' ? 'sub' : 'ass';
      const op = action.card!;
      const skill = threatType === 'ass' ? (op.ass || 2) : (op.sub || 2);
      return {
        threatType,
        threatName: threatType === 'ass' ? 'Assassination Sacrifice' : 'Subterfuge Sacrifice',
        attackPower: (op.off || 4) + engine.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.operationOffenseBuff || 0) + skill,
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'boksoon_ass') {
      const op = action.card!;
      return {
        threatType: 'ass' as const,
        threatName: 'Boksoon Targeted Execution',
        attackPower: (op.off || 4) + engine.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.operationOffenseBuff || 0) + (op.ass || 3),
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'mata_hari_steal') {
      const op = action.card!;
      return {
        threatType: 'sub' as const,
        threatName: 'Mata Hari Hand Infiltration',
        attackPower: (op.off || 3) + engine.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.operationOffenseBuff || 0) + (op.sub || 3),
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'ghost_siphon') {
      const op = action.card!;
      return {
        threatType: 'raid' as const,
        threatName: 'Ghost Resource Siphon',
        attackPower: (op.off || 3) + engine.getCardStatTokensBuff(op) + (op.tempOffenseBuff || 0) + (op.operationOffenseBuff || 0) + (op.raid || 3),
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'ass') {
      let atk = 0;
      for (const a of attackers) {
        atk += (a.off || 1) + engine.getCardStatTokensBuff(a) + (a.ass || 0) + (a.tempOffenseBuff || 0) + (a.operationOffenseBuff || 0);
      }
      return {
        threatType: 'ass' as const,
        threatName: 'Assassination Strike',
        attackPower: atk,
        attackerNames,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'raid') {
      let atk = 0;
      for (const a of attackers) {
        atk += (a.off || 1) + engine.getCardStatTokensBuff(a) + (a.raid || 0) + (a.tempOffenseBuff || 0) + (a.operationOffenseBuff || 0);
      }
      return {
        threatType: 'raid' as const,
        threatName: 'Resource Raid',
        attackPower: atk,
        attackerNames,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'sub') {
      let atk = 0;
      for (const a of attackers) {
        atk += (a.off || 1) + engine.getCardStatTokensBuff(a) + (a.sub || 0) + (a.tempOffenseBuff || 0) + (a.operationOffenseBuff || 0);
      }
      return {
        threatType: 'sub' as const,
        threatName: 'Subterfuge Discard',
        attackPower: atk,
        attackerNames,
        isSpecialAbilityAttack
      };
    }

    return { threatType: 'ass' as const, threatName: 'Attack', attackPower: 1, attackerNames, isSpecialAbilityAttack };
  };

  const recordRecentOperation = (
    attackerPid: 'P1' | 'P2',
    defenderPid: 'P1' | 'P2',
    action: Action,
    chosenDefenderIds: string[] = []
  ) => {
    if (!isAttackAction(action) && action.type !== 'OPERATIVE_ACTION') return;

    const attackerCardIds = (action.attackerCards && action.attackerCards.length > 0)
      ? action.attackerCards.map(c => c.id)
      : (action.cardId ? [action.cardId] : (action.card ? [action.card.id] : []));

    const defenderCardIds = chosenDefenderIds.length > 0
      ? chosenDefenderIds
      : (action.selectedDefenderIds || action.defenderCardIds || []);

    const opState: RecentOperationState = {
      attackerPid,
      defenderPid,
      attackerCardIds,
      defenderCardIds,
      targetCardId: action.targetId || action.targetCard?.id,
      operationType: action.opType || 'operation',
      description: action.desc || 'Operation conducted',
      timestamp: Date.now()
    };

    setRecentOperation(opState);

    if (recentOpTimerRef.current) {
      clearTimeout(recentOpTimerRef.current);
    }
    recentOpTimerRef.current = setTimeout(() => {
      setRecentOperation(null);
    }, 3500);
  };

  const executeAiStep = () => {
    if (!isGameStarted || engine.gameOver || pendingDefense || interruptWindowState) return;
    const currentActive = engine.getActivePlayer();
    const currentOpp = engine.getOpponent();

    setAiThinking(true);
    setTimeout(() => {
      try {
        const bestAction = mctsAgentRef.current.getBestAction(engine, currentActive, currentOpp);
        
        // If AI is attacking a human player who can react or defend, trigger defense assignment prompt!
        if (isAttackAction(bestAction) && !currentOpp.isAI) {
          const attackInfo = getIncomingAttackInfo(bestAction);
          if (canDefenderReactOrDefend(currentOpp, attackInfo.isSpecialAbilityAttack)) {
            const readyOps = currentOpp.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
            const recommended = engine.selectAiDefenders(currentOpp, attackInfo.threatType, attackInfo.attackPower, bestAction.targetCard);
            setPendingDefense({
              attacker: currentActive,
              defender: currentOpp,
              action: bestAction,
              threatType: attackInfo.threatType,
              threatName: attackInfo.threatName,
              incomingAttack: attackInfo.attackPower,
              attackerNames: attackInfo.attackerNames,
              readyOps,
              selectedDefenderIds: recommended.map(c => c.id),
              isSpecialAbilityAttack: attackInfo.isSpecialAbilityAttack
            });
            return;
          }
        }

        if (isAttackAction(bestAction)) {
          recordRecentOperation(currentActive.pid, currentOpp.pid, bestAction, []);
        }
        engine.executeAction(currentActive, currentOpp, bestAction);
      } finally {
        setAiThinking(false);
        onRefresh();
      }
    }, 150);
  };

  const clearCombatSelection = () => {
    setSelectedAttackers([]);
    setSelectedCombatOp(null);
    setSelectedCombatTarget(null);
  };

  const handleActivateInterruptFromDefense = (card: Card, action?: Action) => {
    // Immediately stop opponent's turn and cancel any auto-AI step
    if (autoAiTimerRef.current) {
      clearTimeout(autoAiTimerRef.current);
      autoAiTimerRef.current = null;
    }
    setAiThinking(false);

    const suspended = pendingDefense ? { ...pendingDefense } : null;
    const defender = suspended ? suspended.defender : bottomPlayer;
    const attacker = suspended ? suspended.attacker : topPlayer;

    // Resolve the Interrupt action in engine
    const act: Action = action || {
      type: 'INTERRUPT_ACTION',
      cardId: card.id,
      cardName: card.name,
      card,
      desc: `⚡ Interrupt Seizure: ${card.name}`
    };

    engine.executeAction(defender, attacker, act);

    // Save suspended defense state and activate Interrupt window
    setPendingDefense(null);
    setInterruptWindowState({
      defender,
      attacker,
      sourceCard: card,
      suspendedDefense: suspended
    });

    clearCombatSelection();

    const haltDesc = suspended
      ? `${attacker.name}'s ${suspended.threatName} is immediately STOPPED.`
      : `${attacker.name}'s turn is immediately STOPPED.`;

    engine.log(
      defender.pid,
      'INTERRUPT-SEIZE',
      `⚡⚡ INTERRUPT ACTIVATED! ${defender.name} used ${card.name} out-of-turn! ${haltDesc} ${defender.name} has seized initiative to take actions and launch a Counter-Attack Operation!`
    );

    onRefresh();
  };

  const handleReturnInitiativeFromInterrupt = () => {
    if (!interruptWindowState) return;
    const suspended = interruptWindowState.suspendedDefense;
    if (suspended) {
      engine.log(
        interruptWindowState.defender.pid,
        'INTERRUPT-RETURN',
        `⚡ Interrupt window resolved. Initiative returns back to ${interruptWindowState.attacker.name}. Resuming defense against ${suspended.threatName}.`
      );
      const updatedReady = interruptWindowState.defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
      const nextPending: PendingDefenseState = {
        ...suspended,
        readyOps: updatedReady,
        selectedDefenderIds: suspended.selectedDefenderIds.filter(id => updatedReady.some(o => o.id === id))
      };
      setPendingDefense(nextPending);
    } else {
      engine.log(
        interruptWindowState.defender.pid,
        'INTERRUPT-RETURN',
        `⚡ Interrupt window resolved. Initiative returns back to ${interruptWindowState.attacker.name}.`
      );
      setPendingDefense(null);
    }
    setInterruptWindowState(null);
    clearCombatSelection();
    onRefresh();
  };

  const handleDeployOperativeCrew = (card: Card) => {
    const act = legalActions.find(a => a.type === 'PLAY_CARD' && a.cardId === card.id && (a.subChoice === 'buff_attack_team' || a.subChoice === 'assemble_strike'))
      || {
        type: 'PLAY_CARD',
        cardId: card.id,
        cardName: card.name,
        card,
        subChoice: 'buff_attack_team',
        attackerCards: selectedAttackers,
        targetCard: selectedAttackers[0],
        targetId: selectedAttackers[0]?.id,
        desc: `Deploy ${card.name} (${engine.getCardDeployCost(bottomPlayer, card)} Coins) -> Give +2 OFF to Attack Team`
      };
    handleAction(act);
  };

  const handleExecuteMultiAttack = () => {
    if (selectedAttackers.length === 0 || !selectedCombatOp) return;

    let action: Action;
    const attackerCards = [...selectedAttackers];
    const firstOp = attackerCards[0];

    if (selectedCombatOp === 'ass') {
      if (!selectedCombatTarget) return;
      let totalOff = 0;
      for (const a of attackerCards) {
        totalOff += (a.off || 1) + engine.getCardStatTokensBuff(a) + (a.ass || 0) + (a.tempOffenseBuff || 0) + (a.operationOffenseBuff || 0);
      }
      action = {
        type: 'OPERATIVE_ACTION',
        cardId: firstOp.id,
        cardName: firstOp.name,
        card: firstOp,
        attackerCards,
        targetId: selectedCombatTarget.id,
        targetName: selectedCombatTarget.name,
        targetCard: selectedCombatTarget,
        opType: 'ass',
        desc: `Exhaust Team (${attackerCards.length} Operative${attackerCards.length > 1 ? 's' : ''}) to Assassinate ${selectedCombatTarget.name} [Team OFF: ${totalOff}]`
      };
    } else if (selectedCombatOp === 'raid') {
      if (!selectedCombatTarget) return;
      let totalOff = 0;
      let totalRaidSkill = 0;
      for (const a of attackerCards) {
        totalOff += (a.off || 1) + engine.getCardStatTokensBuff(a) + (a.raid || 0) + (a.tempOffenseBuff || 0) + (a.operationOffenseBuff || 0);
        totalRaidSkill += (a.raid || 0);
      }
      const target = selectedCombatTarget;
      const targetName = target.name;
      const potentialCoins = attackerCards.length + totalRaidSkill;
      action = {
        type: 'OPERATIVE_ACTION',
        cardId: firstOp.id,
        cardName: firstOp.name,
        card: firstOp,
        attackerCards,
        targetId: target.id,
        targetName,
        targetCard: target,
        opType: 'raid',
        desc: `Exhaust Team (${attackerCards.length} Operative${attackerCards.length > 1 ? 's' : ''}) to Raid ${targetName} [Team OFF: ${totalOff}, Potential Yield: ${potentialCoins} Coins]`
      };
    } else {
      // Subterfuge
      let totalOff = 0;
      let totalSubSkill = 0;
      for (const a of attackerCards) {
        totalOff += (a.off || 1) + engine.getCardStatTokensBuff(a) + (a.sub || 0) + (a.tempOffenseBuff || 0) + (a.operationOffenseBuff || 0);
        totalSubSkill += (a.sub || 0);
      }
      const potentialDiscards = attackerCards.length + totalSubSkill;
      action = {
        type: 'OPERATIVE_ACTION',
        cardId: firstOp.id,
        cardName: firstOp.name,
        card: firstOp,
        attackerCards,
        opType: 'sub',
        desc: `Exhaust Team (${attackerCards.length} Operative${attackerCards.length > 1 ? 's' : ''}) for Subterfuge against Hand [Team OFF: ${totalOff}, Potential Yield: ${potentialDiscards} Cards]`
      };
    }

    clearCombatSelection();
    handleAction(action);
  };

  const handleAction = (action: Action) => {
    if (!isGameStarted && !isOnline) return;
    if (pendingDefense) return;
    setPendingTargetSelection(null);

    if (interruptWindowState) {
      // Defending player is performing an action (such as launching a Counter-Attack Operation) during the Interrupt Window!
      engine.executeAction(interruptWindowState.defender, interruptWindowState.attacker, action);

      // Check if original attacker from suspended attack was eliminated during the counter-attack:
      const suspended = interruptWindowState.suspendedDefense;
      if (suspended) {
        const originalAttackerCards = suspended.action.attackerCards || (suspended.action.card ? [suspended.action.card] : []);
        const wasOriginalAttackerEliminated = originalAttackerCards.length > 0 && originalAttackerCards.some(a =>
          interruptWindowState.attacker.discard_pile.some(d => d.id === a.id) ||
          !interruptWindowState.attacker.battlefield.some(b => b.id === a.id)
        );

        if (wasOriginalAttackerEliminated) {
          engine.log(
            interruptWindowState.defender.pid,
            'THWART-INTERRUPT',
            `🎯 ATTACK CANCELLED! The original attacker [${suspended.attackerNames}] was ELIMINATED during ${interruptWindowState.defender.name}'s Interrupt counter-attack! Initiative returns to ${interruptWindowState.attacker.name}.`
          );
          setPendingDefense(null);
          setInterruptWindowState(null);
        } else {
          // Return initiative back to original attacking player and resume suspended defense!
          engine.log(
            interruptWindowState.defender.pid,
            'INTERRUPT-RETURN',
            `⚡ Interrupt action resolved. Initiative returns back to ${interruptWindowState.attacker.name}. Resuming defense against ${suspended.threatName}.`
          );
          const updatedReady = interruptWindowState.defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
          const nextPending: PendingDefenseState = {
            ...suspended,
            readyOps: updatedReady,
            selectedDefenderIds: suspended.selectedDefenderIds.filter(id => updatedReady.some(o => o.id === id))
          };
          setPendingDefense(nextPending);
          setInterruptWindowState(null);
        }
      } else {
        engine.log(
          interruptWindowState.defender.pid,
          'INTERRUPT-RETURN',
          `⚡ Interrupt counter-action resolved. Initiative returns back to ${interruptWindowState.attacker.name}.`
        );
        setInterruptWindowState(null);
      }

      setSelectedCard(null);
      clearCombatSelection();
      onRefresh();
      return;
    }

    if (action.type === 'INTERRUPT_ACTION') {
      engine.executeAction(myPlayer, otherPlayer, action);
      if (isOnline && multiplayerRoom) {
        syncRoomState(
          multiplayerRoom.roomId,
          engine,
          `${myPlayer.name} triggered Interrupt: ${action.desc}`,
          null
        );
      }
      setSelectedCard(null);
      onRefresh();
      return;
    }

    if (isOnline) {
      if (!isMyTurn || !multiplayerRoom) return;

      if (isAttackAction(action)) {
        const attackInfo = getIncomingAttackInfo(action);
        if (canDefenderReactOrDefend(opponent, attackInfo.isSpecialAbilityAttack)) {
          const readyOps = opponent.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
          const defenseData: RoomDefenseData = {
            attackerPid: activePlayer.pid,
            defenderPid: opponent.pid,
            action,
            threatType: attackInfo.threatType,
            threatName: attackInfo.threatName,
            incomingAttack: attackInfo.attackPower,
            attackerNames: attackInfo.attackerNames,
            readyOpIds: readyOps.map(c => c.id),
            selectedDefenderIds: []
          };
          syncRoomState(
            multiplayerRoom.roomId,
            engine,
            `${activePlayer.name} deployed ${attackInfo.threatName}. Awaiting defense!`,
            defenseData
          );
          setSelectedCard(null);
          return;
        }
      }

      engine.executeAction(activePlayer, opponent, action);
      syncRoomState(
        multiplayerRoom.roomId,
        engine,
        `${activePlayer.name} performed ${action.type}: ${action.desc}`,
        null
      );
      setSelectedCard(null);
      onRefresh();
      return;
    }

    // If attacking human opponent (e.g. Pass & Play mode) who can react or defend, allow defense assignment
    if (isAttackAction(action) && !opponent.isAI) {
      const attackInfo = getIncomingAttackInfo(action);
      if (canDefenderReactOrDefend(opponent, attackInfo.isSpecialAbilityAttack)) {
        const readyOps = opponent.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
        const recommended = engine.selectAiDefenders(opponent, attackInfo.threatType, attackInfo.attackPower, action.targetCard);
        setPendingDefense({
          attacker: activePlayer,
          defender: opponent,
          action,
          threatType: attackInfo.threatType,
          threatName: attackInfo.threatName,
          incomingAttack: attackInfo.attackPower,
          attackerNames: attackInfo.attackerNames,
          readyOps,
          selectedDefenderIds: recommended.map(c => c.id),
          isSpecialAbilityAttack: attackInfo.isSpecialAbilityAttack
        });
        setSelectedCard(null);
        return;
      }
    }

    if (isAttackAction(action)) {
      recordRecentOperation(activePlayer.pid, opponent.pid, action, []);
    }
    engine.executeAction(activePlayer, opponent, action);
    setSelectedCard(null);
    onRefresh();
  };

  const handleConfirmDefense = (chosenDefenderIds: string[], bonusDefense: number = 0) => {
    if (!pendingDefense) return;
    recordRecentOperation(
      pendingDefense.attacker.pid,
      pendingDefense.defender.pid,
      pendingDefense.action,
      chosenDefenderIds
    );
    engine.executeAction(
      pendingDefense.attacker,
      pendingDefense.defender,
      pendingDefense.action,
      chosenDefenderIds,
      bonusDefense
    );

    if (isOnline && multiplayerRoom) {
      syncRoomState(
        multiplayerRoom.roomId,
        engine,
        `${pendingDefense.defender.name} assigned ${chosenDefenderIds.length} defensive interceptor(s).`,
        null
      );
    }

    setPendingDefense(null);
    setSelectedCard(null);
    onRefresh();
  };

  const handleStartGame = () => {
    if (engine.gameOver || isGameStarted) return;
    setIsGameStarted(true);
    const active = engine.getActivePlayer();
    engine.log(
      active.pid,
      'GAME-START',
      `▶️ Match Started! ${active.name} (${active.pid}) has initiative for Round 1.`
    );
    onRefresh();
  };

  // Manual Trigger: executes exactly 1 AI action and pauses so the user can inspect
  const handleManualTriggerAi = () => {
    if (engine.gameOver || aiThinking || pendingDefense) return;
    if (!isGameStarted) {
      setIsGameStarted(true);
    }
    executeAiStep();
  };

  const handleResetGame = () => {
    localStorage.removeItem('spywar_active_match_session');
    setIsGameStarted(false);
    setRecentOperation(null);
    if (recentOpTimerRef.current) clearTimeout(recentOpTimerRef.current);
    const shouldAuto = gameMode === 'human_vs_ai' || gameMode === 'ai_vs_ai';
    setAutoAi(shouldAuto);
    if (autoAiTimerRef.current) clearTimeout(autoAiTimerRef.current);
    setPendingDefense(null);
    clearCombatSelection();

    const cardDb = CardDatabaseService.getInstance();
    const deckData = cardDb.generateGameDeckForEngine();
    engine.setGameMode(gameMode);
    engine.setupGame({
      ...deckData,
      deckName: cardDb.getActiveDeck().name,
    });
    setSelectedCard(null);
    onRefresh();
  };

  // Export and download match notation log stream as text file
  const handleDownloadLog = () => {
    const text = engine.exportMatchLog();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spywar-match-log-R${engine.currentRound}-${Date.now()}.txt`;
    a.click();
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Top Status Banner & Game Controls */}
      <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* GAME MODE SELECTOR */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs shadow-inner flex-wrap">
            <button
              id="mode-human-vs-ai"
              onClick={() => handleModeChange('human_vs_ai')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                gameMode === 'human_vs_ai'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="You control P1 (Human), ISMCTS AI controls P2"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Human vs AI</span>
            </button>
            <button
              id="mode-ai-vs-ai"
              onClick={() => handleModeChange('ai_vs_ai')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                gameMode === 'ai_vs_ai'
                  ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Spectate: ISMCTS AI controls both P1 and P2"
            >
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>AI vs AI</span>
            </button>
            <button
              id="mode-pass-play"
              onClick={() => handleModeChange('pass_and_play')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                gameMode === 'pass_and_play'
                  ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="2-Player Local Pass & Play on this device"
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Pass & Play</span>
            </button>
            <button
              id="mode-online"
              onClick={() => handleModeChange('online_multiplayer')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                gameMode === 'online_multiplayer'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Online Human vs Human multiplayer over the internet"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Online Match</span>
            </button>
          </div>

          {/* ONLINE ROOM STATUS HEADER BADGE (WHEN ONLINE) */}
          {isOnline && multiplayerRoom && (
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded-lg border border-emerald-500/30 text-xs">
              <span className="text-[10px] font-mono text-zinc-400">ROOM:</span>
              <span className="font-mono font-bold text-emerald-300 tracking-wider">
                {multiplayerRoom.roomId}
              </span>

              <button
                onClick={handleCopyCode}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-emerald-300 transition-colors"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleCopyLink}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-emerald-300 transition-colors"
                title="Copy Direct Share Link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5" />}
              </button>

              <div className="h-3 w-px bg-zinc-800" />

              <span className="text-[11px] text-zinc-300">
                You: <strong className="text-emerald-300">{bottomPlayer.name} ({myPid})</strong>
              </span>

              <div className="h-3 w-px bg-zinc-800" />

              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                multiplayerRoom.status === 'playing'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}>
                {multiplayerRoom.status === 'playing' ? 'Connected' : 'Waiting for Agent 2'}
              </span>

              <button
                onClick={handleLeaveOnlineRoom}
                className="ml-1 p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                title="Leave Online Match"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Round Counter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono uppercase text-zinc-400">Round</span>
            <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              {engine.currentRound} / {engine.config.rounds}
            </span>
          </div>

          {/* Active Player Indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400">Turn:</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
              activePlayer.pid === 'P1'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {activePlayer.isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {activePlayer.name} ({activePlayer.pid})
            </span>
          </div>

          {/* Explicit Phase Indicator */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-zinc-400 text-[11px]">Phase:</span>
            <div className="flex items-center gap-1">
              {(['DRAW', 'OPERATIONS', 'CLEANUP'] as const).map(phase => {
                const isActive = engine.currentPhase === phase;
                return (
                  <span
                    key={phase}
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border transition-colors ${
                      isActive
                        ? phase === 'OPERATIONS'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                          : phase === 'DRAW'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-zinc-800/50 text-zinc-500 border-zinc-800'
                    }`}
                  >
                    {phase}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Global Dominion Plan Ready Indicator */}
        {engine.canPlayGlobalDominionPlan(activePlayer) && (
          <div className="flex items-center gap-1 text-xs font-mono text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/40 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Global Dominion Plan Playable!
          </div>
        )}

        {/* CONTROLS (STEP AI, AUTOPLAY, RESET) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI SPEED CONTROL WITH +/- BUTTONS (Can slow to a crawl or speed up) */}
          {(gameMode === 'human_vs_ai' || gameMode === 'ai_vs_ai' || autoAi) && (
            <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px] font-mono shadow-sm">
              <span className="text-zinc-400 font-semibold">AI Speed:</span>
              <button
                type="button"
                onClick={() => {
                  // Slower AI speed = increase delay up to ultra crawl (20s)
                  setAiSpeed(prev => {
                    if (prev < 300) return prev + 150;
                    if (prev < 800) return prev + 250;
                    if (prev < 2000) return prev + 500;
                    if (prev < 5000) return prev + 1000;
                    if (prev < 10000) return prev + 2500;
                    return Math.min(20000, prev + 5000);
                  });
                }}
                className="px-2 py-0.5 flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white font-bold transition-all cursor-pointer border border-zinc-700 hover:border-amber-500/50"
                title="Slower (-) — Increase delay between AI actions (slow to a crawl, up to 20s)"
              >
                <Minus className="w-3.5 h-3.5" />
                <span className="text-[10px]">Slower</span>
              </button>

              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                  aiSpeed >= 10000
                    ? 'bg-amber-950/90 text-amber-300 border-amber-500 shadow-sm animate-pulse'
                    : aiSpeed >= 3000
                    ? 'bg-amber-950/70 text-amber-300 border-amber-600/60'
                    : aiSpeed >= 1500
                    ? 'bg-blue-950/70 text-blue-300 border-blue-600/50'
                    : aiSpeed >= 600
                    ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                }`}
                title={`Delay between AI actions: ${aiSpeed}ms (${(aiSpeed / 1000).toFixed(2)}s). Use +/- buttons to adjust.`}
              >
                {aiSpeed >= 10000 ? `🐌 Ultra Crawl (${(aiSpeed / 1000).toFixed(1)}s)` :
                 aiSpeed >= 3000 ? `🐢 Crawl (${(aiSpeed / 1000).toFixed(1)}s)` :
                 aiSpeed >= 1500 ? `🚶 Slow (${(aiSpeed / 1000).toFixed(1)}s)` :
                 aiSpeed >= 600 ? `⚖️ Normal (${(aiSpeed / 1000).toFixed(1)}s)` :
                 aiSpeed <= 200 ? `⚡ Fast (${aiSpeed}ms)` :
                 `${(aiSpeed / 1000).toFixed(2)}s`}
              </span>

              <button
                type="button"
                onClick={() => {
                  // Faster AI speed = decrease delay down to 50ms
                  setAiSpeed(prev => {
                    if (prev > 10000) return prev - 5000;
                    if (prev > 5000) return prev - 2500;
                    if (prev > 2000) return prev - 1000;
                    if (prev > 800) return prev - 500;
                    if (prev > 300) return prev - 250;
                    return Math.max(50, prev - 150);
                  });
                }}
                className="px-2 py-0.5 flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white font-bold transition-all cursor-pointer border border-zinc-700 hover:border-emerald-500/50"
                title="Faster (+) — Decrease delay between AI actions (down to 50ms)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[10px]">Faster</span>
              </button>
            </div>
          )}

          {/* AI DIFFICULTY / MCTS BRANCH COMPUTATION CONTROL WITH +/- BUTTONS */}
          {(gameMode === 'human_vs_ai' || gameMode === 'ai_vs_ai' || autoAi) && (
            <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px] font-mono shadow-sm">
              <span className="text-zinc-400 font-semibold flex items-center gap-1">
                <Brain className="w-3.5 h-3.5 text-indigo-400" />
                AI Skill:
              </span>
              <button
                type="button"
                disabled={aiDifficulty <= 1}
                onClick={() => {
                  const next = Math.max(1, aiDifficulty - 1);
                  setAiDifficulty(next);
                  try { localStorage.setItem('spywar_ai_difficulty', String(next)); } catch {}
                }}
                className={`px-2 py-0.5 flex items-center gap-1 rounded font-bold transition-all border ${
                  aiDifficulty <= 1
                    ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed opacity-50'
                    : 'bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white cursor-pointer border-zinc-700 hover:border-amber-500/50'
                }`}
                title="Easier (-) — Reduce Monte Carlo tree rollout branches (down to 15 branches)"
              >
                <Minus className="w-3.5 h-3.5" />
                <span className="text-[10px]">Easier</span>
              </button>

              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${currentDiffConfig.colorClass}`}
                title={`AI Difficulty Lv.${currentDiffConfig.level}/10 (${currentDiffConfig.name}): ${currentDiffConfig.description}`}
              >
                {currentDiffConfig.emoji} Lv.{currentDiffConfig.level} {currentDiffConfig.shortName} ({currentDiffConfig.iterations} br)
              </span>

              <button
                type="button"
                disabled={aiDifficulty >= 10}
                onClick={() => {
                  const next = Math.min(10, aiDifficulty + 1);
                  setAiDifficulty(next);
                  try { localStorage.setItem('spywar_ai_difficulty', String(next)); } catch {}
                }}
                className={`px-2 py-0.5 flex items-center gap-1 rounded font-bold transition-all border ${
                  aiDifficulty >= 10
                    ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed opacity-50'
                    : 'bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 hover:text-white cursor-pointer border-zinc-700 hover:border-emerald-500/50'
                }`}
                title="Harder (+) — Increase Monte Carlo tree rollout branches (up to 750 branches)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[10px]">Harder</span>
              </button>
            </div>
          )}

          {/* MANUAL SINGLE-STEP TRIGGER AI MOVE (Active when it's AI turn) */}
          {activePlayer.isAI && (
            <button
              id="btn-step-ai"
              onClick={handleManualTriggerAi}
              disabled={aiThinking || engine.gameOver}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors shadow-sm relative group"
              title="Execute 1 AI decision and pause for review (Shortcut: Space or S)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {aiThinking ? 'AI Thinking...' : `Step AI (${activePlayer.pid})`}
              <span className="hidden sm:inline-block ml-1 px-1.5 py-0.2 text-[10px] bg-indigo-800/90 rounded font-mono border border-indigo-400/30">
                S
              </span>
            </button>
          )}

          {/* AUTOPLAY TOGGLE */}
          <button
            id="btn-auto-ai"
            onClick={() => setAutoAi(!autoAi)}
            disabled={engine.gameOver || gameMode === 'pass_and_play'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
              autoAi
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
            title={
              gameMode === 'human_vs_ai'
                ? 'Auto-play only activates during AI (P2) turns'
                : gameMode === 'ai_vs_ai'
                ? 'Continuously runs both AI opponents until completion'
                : 'Disabled in Pass & Play mode'
            }
          >
            {autoAi ? <Pause className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            {autoAi
              ? 'Pause Auto-Play'
              : gameMode === 'ai_vs_ai'
              ? 'Auto-Play Match'
              : 'Auto-Play AI (P2)'}
          </button>

          {/* CONFIGURATION SETTINGS BUTTON */}
          <button
            id="btn-settings-config"
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700/60"
            title="Configure Game Rules & Simulation Parameters (8 Settings)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* EXPORT LOG BUTTON */}
          <button
            id="btn-download-log"
            onClick={handleDownloadLog}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700/60"
            title="Download Complete Match Notation & Event Log Stream (.txt)"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Log</span>
          </button>

          <button
            id="btn-reset-match"
            onClick={handleResetGame}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700/60"
            title="Reset & Initialize Match"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          {/* START MATCH BUTTON */}
          <button
            id="btn-start-match"
            onClick={handleStartGame}
            disabled={engine.gameOver || isGameStarted}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-sm ${
              !isGameStarted && !engine.gameOver
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/60 ring-2 ring-emerald-500/30'
                : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-not-allowed opacity-60'
            }`}
            title={
              isGameStarted
                ? 'Match is currently in progress'
                : engine.gameOver
                ? 'Match concluded'
                : `Start Match (${activePlayer.name} has initiative)`
            }
          >
            <Play className={`w-3.5 h-3.5 ${!isGameStarted && !engine.gameOver ? 'fill-white text-white' : 'text-zinc-500'}`} />
            <span>{isGameStarted ? 'Started' : 'Start'}</span>
          </button>
        </div>
      </div>

      {/* ACTIVE DECK & STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Deck:
          </span>
          <span className="font-semibold text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-[11px]">
            {engine.activeDeckName || 'Official Standard'}
          </span>
          {onNavigateToDeckBuilder && (
            <button
              onClick={onNavigateToDeckBuilder}
              className="text-cyan-400 hover:text-cyan-300 text-[11px] underline font-medium ml-1"
            >
              Customize Deck
            </button>
          )}
          {onNavigateToCardEditor && (
            <button
              onClick={onNavigateToCardEditor}
              className="text-amber-400 hover:text-amber-300 text-[11px] underline font-medium ml-1"
            >
              Card Editor
            </button>
          )}
        </div>

        {/* Match Ready / Waiting to Start Banner */}
        {!isGameStarted && !engine.gameOver ? (
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-[11px] font-mono flex items-center gap-1.5 font-semibold bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Match Initialized &mdash; Click &quot;Start&quot; to begin ({activePlayer.name} has initiative)
            </span>
          </div>
        ) : activePlayer.isAI && !engine.gameOver ? (
          <div className="flex items-center gap-2">
            {pendingDefense ? (
              <span className="text-amber-300 text-[11px] font-mono flex items-center gap-1.5 animate-pulse">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Incoming {pendingDefense.threatName} attack! Choose your defense response below...
              </span>
            ) : autoAi ? (
              <span className="text-indigo-300 text-[11px] font-mono flex items-center gap-1.5 animate-pulse">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                AI ({activePlayer.pid}) exploring {currentDiffConfig.iterations} MCTS branches (Lv.{currentDiffConfig.level} {currentDiffConfig.shortName})...
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-amber-300 text-[11px] font-mono">
                  AI paused. Press <strong>S</strong> or click:
                </span>
                <button
                  onClick={() => setAutoAi(true)}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold"
                >
                  Enable Auto AI
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Game Over Banner */}
      {engine.gameOver && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/70 to-rose-950/70 border border-amber-500/50 shadow-xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-amber-300 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              MATCH CONCLUDED: {engine.winner ? `${engine.winner.name} WINS!` : 'MATCH TIED!'}
            </h3>
            <p className="text-xs text-zinc-300 mt-0.5">{engine.winReason}</p>
          </div>
          <button
            onClick={handleResetGame}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {/* ACTIVE MISSIONS ROW (CENTER TABLE) */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            Active Table Missions ({engine.missionsOnTable.length})
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
              Drawn 1 face-up per round | Physical tokens placed in real-time
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-amber-400 text-[10px] font-mono font-medium">
              <ZoomIn className="w-3 h-3 text-amber-400" />
              <span>Hover + [Space] to Zoom</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {engine.missionsOnTable.map(mission => {
            const missionItem = { ...mission, type: 'Mission' as const };
            const isHighlighted = highlightedItem?.id === mission.id;
            return (
              <div
                key={mission.id}
                tabIndex={0}
                role="button"
                aria-label={`Mission: ${mission.name}. Press Spacebar to zoom.`}
                onMouseEnter={() => setHighlightedItem(missionItem)}
                onMouseLeave={() => clearHighlightedItem(missionItem)}
                onFocus={() => setHighlightedItem(missionItem)}
                onClick={() => openZoom(missionItem)}
                className={`p-2.5 rounded-lg bg-zinc-950 border transition-all cursor-pointer relative group select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isHighlighted
                    ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-emerald-500/20 shadow-md'
                    : 'border-emerald-900/40 hover:border-emerald-600/70'
                } space-y-1.5`}
              >
                {/* Zoom Trigger Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openZoom(missionItem);
                  }}
                  title="Magnify mission 3x/5x (or press Spacebar)"
                  className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-zinc-900 border border-emerald-500/70 text-emerald-400 hover:text-white hover:bg-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity shadow-md"
                >
                  <ZoomIn className="w-2.5 h-2.5" />
                </button>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-100">{mission.name}</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    +{mission.points} pts
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 line-clamp-2">{mission.description}</p>
                
                {/* Token Progress Bar */}
                <div className="pt-1 text-[10px] font-mono space-y-1 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-blue-300">
                    <span>P1 Tokens:</span>
                    <span className="font-bold">{mission.tokens.P1 || 0} / {mission.req}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${Math.min(100, ((mission.tokens.P1 || 0) / mission.req) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-rose-300 mt-1">
                    <span>P2 Tokens:</span>
                    <span className="font-bold">{mission.tokens.P2 || 0} / {mission.req}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{ width: `${Math.min(100, ((mission.tokens.P2 || 0) / mission.req) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {engine.missionsOnTable.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-zinc-500 italic">
              All revealed missions have been claimed!
            </div>
          )}
        </div>
      </div>

      {/* ONLINE MATCH STAGING ROOM BANNER (WAITING FOR GUEST) */}
      {isOnline && multiplayerRoom?.status === 'waiting' && (
        <div className="p-5 rounded-xl bg-gradient-to-r from-blue-950/50 via-zinc-900 to-indigo-950/50 border-2 border-dashed border-blue-500/50 shadow-xl space-y-3 animate-pulse">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Globe className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-200 flex items-center gap-2">
                  Multiplayer Room Created &amp; Ready
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Awaiting Opponent
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Share your Room Code or Invite Link with another player. Once they join, the match starts automatically!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-blue-500/40 font-mono text-base font-bold text-amber-400 tracking-wider">
                {multiplayerRoom.roomId}
              </div>

              <button
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-semibold flex items-center gap-1.5 border border-zinc-700 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <LinkIcon className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPPONENT AREA (TOP PLAYER) */}
      <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-300">
              {topPlayer.name} ({topPlayer.pid}) {isOnline ? '[Opponent Agent]' : ''}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              Points: {topPlayer.mission_points}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              <span>Spendable: {engine.getTotalSpendableCoins(topPlayer)}</span>
              <span className="text-[10px] text-zinc-500">(Turn: {topPlayer.current_turn_coins}, Stored: {engine.getStoredCoins(topPlayer)})</span>
            </div>
            <span className="text-zinc-400">Hand: {topPlayer.hand.length} cards</span>
          </div>
        </div>

        {/* Opponent Battlefield Cards */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {topPlayer.affiliation && (() => {
            const isAffiliationTarget = selectedCombatTarget?.id === topPlayer.affiliation.id || (
              pendingDefense &&
              pendingDefense.defender.pid === topPlayer.pid &&
              (pendingDefense.action.targetId === topPlayer.affiliation.id || pendingDefense.action.targetCard?.id === topPlayer.affiliation.id)
            );
            const isAffiliationAttacker = !!(
              (pendingDefense &&
                pendingDefense.attacker.pid === topPlayer.pid &&
                (
                  pendingDefense.action.cardId === topPlayer.affiliation.id ||
                  pendingDefense.action.card?.id === topPlayer.affiliation.id ||
                  (pendingDefense.action.attackerCards && pendingDefense.action.attackerCards.some(a => a.id === topPlayer.affiliation.id))
                )
              ) || (
                !pendingDefense && !interruptWindowState &&
                recentOperation &&
                recentOperation.attackerPid === topPlayer.pid &&
                recentOperation.attackerCardIds.includes(topPlayer.affiliation.id)
              )
            );
            const isAffiliationDefender = !!(
              (pendingDefense &&
                pendingDefense.defender.pid === topPlayer.pid &&
                pendingDefense.selectedDefenderIds.includes(topPlayer.affiliation.id)
              ) || (
                !pendingDefense && !interruptWindowState &&
                recentOperation &&
                recentOperation.defenderPid === topPlayer.pid &&
                recentOperation.defenderCardIds.includes(topPlayer.affiliation.id)
              )
            );

            let affRole: 'attacker' | 'defender' | 'target' | undefined = undefined;
            let affBadge: string | undefined = undefined;

            if (isAffiliationAttacker) {
              affRole = 'attacker';
              affBadge = pendingDefense ? '⚔️ Attacking' : '⚔️ Attacked';
            } else if (isAffiliationDefender) {
              affRole = 'defender';
              affBadge = pendingDefense ? '🛡️ Defending' : '🛡️ Defended';
            } else if (isAffiliationTarget) {
              affRole = 'target';
              affBadge = '🎯 Target';
            }

            return (
              <CardView
                card={topPlayer.affiliation}
                compact
                selected={isAffiliationTarget || isAffiliationAttacker || isAffiliationDefender || selectedCard?.id === topPlayer.affiliation.id}
                selectionRole={affRole}
                selectionBadge={affBadge}
                onClick={() => {
                  if (selectedAttackers.length > 0) {
                    setSelectedCombatTarget(selectedCombatTarget?.id === topPlayer.affiliation.id ? null : topPlayer.affiliation);
                  } else {
                    setSelectedCard(selectedCard?.id === topPlayer.affiliation.id ? null : topPlayer.affiliation);
                  }
                }}
              />
            );
          })()}
          {topPlayer.battlefield.map(card => {
            // (1) Target checks (targeted by combat planner or incoming operation):
            const isCombatTarget = selectedCombatTarget?.id === card.id || (
              pendingDefense &&
              pendingDefense.defender.pid === topPlayer.pid &&
              (pendingDefense.action.targetId === card.id || pendingDefense.action.targetCard?.id === card.id)
            );

            // (2) Opponent Operative ATTACKING in an active operation:
            const isAttackingInPendingDefense = !!(
              pendingDefense &&
              pendingDefense.attacker.pid === topPlayer.pid &&
              (
                (pendingDefense.action.attackerCards && pendingDefense.action.attackerCards.some(a => a.id === card.id)) ||
                pendingDefense.action.card?.id === card.id ||
                pendingDefense.action.cardId === card.id
              )
            );

            // (3) Opponent Operative suspended attacker during Interrupt Window:
            const isSuspendedAttacker = !!(
              interruptWindowState &&
              interruptWindowState.attacker.pid === topPlayer.pid &&
              (
                (interruptWindowState.suspendedDefense?.action.attackerCards && interruptWindowState.suspendedDefense.action.attackerCards.some(a => a.id === card.id)) ||
                interruptWindowState.suspendedDefense?.action.card?.id === card.id ||
                interruptWindowState.suspendedDefense?.action.cardId === card.id
              )
            );

            // (4) Opponent Operative executing an Interrupt ability:
            const isInterruptAttacker = !!(
              interruptWindowState &&
              interruptWindowState.defender.pid === topPlayer.pid &&
              interruptWindowState.sourceCard.id === card.id
            );

            // (5) Opponent Operative DEFENDING in an active operation:
            const isDefendingInPendingDefense = !!(
              pendingDefense &&
              pendingDefense.defender.pid === topPlayer.pid &&
              (
                pendingDefense.selectedDefenderIds.includes(card.id) ||
                (pendingDefense.action.selectedDefenderIds && pendingDefense.action.selectedDefenderIds.includes(card.id)) ||
                (pendingDefense.action.defenderCardIds && pendingDefense.action.defenderCardIds.includes(card.id))
              )
            );

            // (6) Recent Operation (Attacked or Defended within last 3.5s):
            const isRecentAttacker = !pendingDefense && !interruptWindowState && !!(
              recentOperation &&
              recentOperation.attackerPid === topPlayer.pid &&
              recentOperation.attackerCardIds.includes(card.id)
            );

            const isRecentDefender = !pendingDefense && !interruptWindowState && !!(
              recentOperation &&
              recentOperation.defenderPid === topPlayer.pid &&
              recentOperation.defenderCardIds.includes(card.id)
            );

            const isAttacker = isAttackingInPendingDefense || isSuspendedAttacker || isInterruptAttacker || isRecentAttacker;
            const isDefender = isDefendingInPendingDefense || isRecentDefender;

            const isEnemyTargetCandidate = pendingTargetSelection?.actions.some(a => a.targetId === card.id);
            const candidateAct = pendingTargetSelection?.actions.find(a => a.targetId === card.id);

            let role: 'attacker' | 'defender' | 'target' | undefined = undefined;
            let badge: string | undefined = undefined;

            if (isAttacker) {
              role = 'attacker';
              if (isAttackingInPendingDefense) {
                badge = '⚔️ Attacking';
              } else if (isSuspendedAttacker) {
                badge = '⚔️ Suspended Attacker';
              } else if (isInterruptAttacker) {
                badge = '⚡ Interrupt Operative';
              } else {
                badge = '⚔️ Attacked';
              }
            } else if (isDefender) {
              role = 'defender';
              badge = isDefendingInPendingDefense ? '🛡️ Defending' : '🛡️ Defended';
            } else if (isEnemyTargetCandidate) {
              role = 'target';
              badge = candidateAct?.disabled ? 'Cannot Target' : '🎯 Target';
            } else if (isCombatTarget) {
              role = 'target';
              badge = '🎯 Target';
            }

            const isSelected = isAttacker || isDefender || isCombatTarget || selectedCard?.id === card.id || isEnemyTargetCandidate;

            return (
              <CardView
                key={card.id}
                card={card}
                compact
                selected={isSelected}
                selectionRole={role}
                selectionBadge={badge}
                onClick={() => {
                  if (pendingTargetSelection) {
                    const match = pendingTargetSelection.actions.find(a => a.targetId === card.id);
                    if (match && !match.disabled) {
                      handleAction(match);
                      setPendingTargetSelection(null);
                      return;
                    }
                  }
                  if (pendingDefense && pendingDefense.defender.pid === topPlayer.pid && (!isOnline || pendingDefense.defender.pid === myPid)) {
                    if (card.type === 'Operative' && !card.exhausted) {
                      const nextIds = pendingDefense.selectedDefenderIds.includes(card.id)
                        ? pendingDefense.selectedDefenderIds.filter(id => id !== card.id)
                        : [...pendingDefense.selectedDefenderIds, card.id];
                      setPendingDefense({
                        ...pendingDefense,
                        selectedDefenderIds: nextIds
                      });
                    }
                    return;
                  }
                  if (selectedAttackers.length > 0) {
                    setSelectedCombatTarget(isCombatTarget ? null : card);
                  } else {
                    setSelectedCard(selectedCard?.id === card.id ? null : card);
                  }
                }}
              />
            );
          })}
          {topPlayer.battlefield.length === 0 && !topPlayer.affiliation && (
            <div className="text-xs text-zinc-500 italic py-4">No cards in play</div>
          )}
        </div>
      </div>

      {/* OFF-TURN INTERRUPT SPECIAL ABILITIES BAR (DEFENDING/OFF-TURN ACTIVATION) */}
      {!isMyTurn && !pendingDefense && !interruptWindowState && offTurnInterruptCandidates.length > 0 && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-yellow-950/80 via-amber-950/60 to-zinc-950 border-2 border-yellow-500 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-yellow-500/30 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                <Zap className="w-4 h-4 fill-current animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                  <span>⚡ OFF-TURN INTERRUPT: STOP OPPONENT'S TURN &amp; SEIZE INITIATIVE</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 font-mono border border-yellow-500/40 uppercase">
                    Defense / Off-Turn
                  </span>
                </h4>
                <p className="text-[10px] text-zinc-300 font-mono">
                  {activePlayer.name} is taking their turn. You have cards with <strong>Interrupt special ability in Ready condition</strong>! Activating immediately stops their turn so you can launch a Counter-Attack Operation!
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono text-zinc-300 bg-black/60 px-2.5 py-1 rounded-lg border border-zinc-800">
              Spendable: <strong className="text-amber-300">{offTurnSpendable} Coins</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {offTurnInterruptCandidates.map(cand => {
              const canActivate = cand.isReady && cand.hasEnoughCoins;
              return (
                <div
                  key={`${cand.location}_${cand.card.id}`}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-2.5 font-mono text-xs transition-all ${
                    canActivate
                      ? 'bg-zinc-900/90 border-yellow-500/60 shadow-md'
                      : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-500 opacity-60'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-100 truncate">{cand.card.name}</span>
                      <span className="text-[9px] px-1 rounded bg-zinc-800 text-zinc-300 uppercase shrink-0">
                        {cand.location === 'affiliation' ? 'Affiliation' : cand.location === 'battlefield' ? (cand.isPassive ? 'Passive' : 'Ready') : 'Hand'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {cand.cost > 0 ? `Cost: ${cand.cost} Coins` : 'Cost: Free'} {!cand.isReady && '• Exhausted (Not Ready)'}
                    </div>
                  </div>

                  {canActivate ? (
                    <button
                      type="button"
                      onClick={() => handleActivateInterruptFromDefense(cand.card, cand.action)}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 active:scale-95 text-black font-extrabold text-[11px] shrink-0 shadow-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Seize Initiative</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-red-400 font-bold shrink-0">
                      {!cand.isReady ? 'Must be Ready' : `Need ${cand.cost} Coins`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PLAYER AREA (BOTTOM PLAYER - YOU) */}
      <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-300">
              {bottomPlayer.name} ({bottomPlayer.pid}) {isOnline ? '[Your Operations]' : (activePlayer.pid === bottomPlayer.pid ? '[Active Player]' : '')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Points: {bottomPlayer.mission_points}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-amber-400">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm">Spendable: {engine.getTotalSpendableCoins(bottomPlayer)}</span>
              <span className="text-[11px] text-zinc-400">
                (Floating Turn: {bottomPlayer.current_turn_coins}, Stored: {engine.getStoredCoins(bottomPlayer)})
              </span>
            </div>
            <button
              disabled={!isMyTurn}
              onClick={() => handleAction({ type: 'PASS', desc: 'Pass turn' })}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                !isMyTurn
                  ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
              }`}
            >
              Pass Turn &rarr;
            </button>
          </div>
        </div>

        {/* Player Battlefield Cards */}
        <div>
          <div className="text-[11px] font-mono text-zinc-400 mb-1 flex items-center justify-between">
            <span>Battlefield &amp; Affiliation in Play:</span>
            <span className="text-[10px] text-amber-400/90 font-mono">
              Tip: Hold Shift + Click Ready Operatives to assemble an attack team
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {bottomPlayer.affiliation && (() => {
              const isTech = bottomPlayer.affiliation.specialAbility === 'buff_tech_token' || bottomPlayer.affiliation.specialAbility === 'grant_tech_token' || bottomPlayer.affiliation.name === 'M.I.C.A.';
              const isSkill = bottomPlayer.affiliation.specialAbility === 'buff_skill' || bottomPlayer.affiliation.specialAbility === 'grant_skill_token' || bottomPlayer.affiliation.name.includes('MI6');
              const promptTitle = isSkill
                ? `${bottomPlayer.affiliation.name}: Bestow Skill Token`
                : isTech
                ? `${bottomPlayer.affiliation.name}: Bestow +1/+1 Tech Token`
                : `${bottomPlayer.affiliation.name}: Select Target`;
              const promptDescription = isSkill
                ? `Select which Operative in play will receive the +1 Skill token (Assassination, Raid, or Subterfuge):`
                : isTech
                ? `Select which Operative in play will receive the +1/+1 Tech token:`
                : `Select which Operative in play will receive the benefit:`;
              const effectType = isSkill ? 'skill_token' : 'tech_token';
              const playLabel = isSkill ? 'Grant Skill Token' : isTech ? 'Grant Tech Token' : 'Activate';

              return (
                <CardView
                  card={bottomPlayer.affiliation}
                  selected={selectedCard?.id === bottomPlayer.affiliation.id || pendingTargetSelection?.sourceCard.id === bottomPlayer.affiliation.id}
                  isPlayable={!bottomPlayer.affiliation.exhausted && (!isOnline || isMyTurn)}
                  playLabel={playLabel}
                  onPlay={() => {
                    const targetActs = legalActions.filter(a => (a.type === 'TAP_ABILITY' || a.type === 'DYNAMIC_ABILITY') && a.cardId === bottomPlayer.affiliation?.id && a.targetId);
                    if (targetActs.length > 0) {
                      setSelectedCard(bottomPlayer.affiliation);
                      setPendingTargetSelection({
                        sourceCard: bottomPlayer.affiliation,
                        promptTitle,
                        promptDescription,
                        effectType,
                        actions: targetActs
                      });
                      return;
                    }
                    const directAct = legalActions.find(a => (a.type === 'TAP_ABILITY' || a.type === 'DYNAMIC_ABILITY') && a.cardId === bottomPlayer.affiliation?.id);
                    if (directAct) handleAction(directAct);
                  }}
                  onClick={() => {
                    if (pendingTargetSelection?.sourceCard.id === bottomPlayer.affiliation?.id) {
                      setPendingTargetSelection(null);
                      setSelectedCard(null);
                      return;
                    }
                    const isToggleOff = selectedCard?.id === bottomPlayer.affiliation.id;
                    setSelectedCard(isToggleOff ? null : bottomPlayer.affiliation);
                    if (!isToggleOff && !bottomPlayer.affiliation.exhausted) {
                      const targetActs = legalActions.filter(a => (a.type === 'TAP_ABILITY' || a.type === 'DYNAMIC_ABILITY') && a.cardId === bottomPlayer.affiliation?.id && a.targetId);
                      if (targetActs.length > 0) {
                        setPendingTargetSelection({
                          sourceCard: bottomPlayer.affiliation,
                          promptTitle,
                          promptDescription,
                          effectType,
                          actions: targetActs
                        });
                        return;
                      }
                    }
                    setPendingTargetSelection(null);
                  }}
                />
              );
            })()}
            {bottomPlayer.battlefield.map(card => {
              const isAttackerSelection = selectedAttackers.some(a => a.id === card.id);
              const isAttackerInPendingDefense = !!(
                pendingDefense &&
                pendingDefense.attacker.pid === bottomPlayer.pid &&
                (
                  (pendingDefense.action.attackerCards && pendingDefense.action.attackerCards.some(a => a.id === card.id)) ||
                  pendingDefense.action.card?.id === card.id ||
                  pendingDefense.action.cardId === card.id
                )
              );
              const isDefenderInPendingDefense = !!(
                pendingDefense &&
                pendingDefense.defender.pid === bottomPlayer.pid &&
                pendingDefense.selectedDefenderIds.includes(card.id)
              );
              const isTarget = selectedCombatTarget?.id === card.id || (
                pendingDefense &&
                pendingDefense.defender.pid === bottomPlayer.pid &&
                (pendingDefense.action.targetId === card.id || pendingDefense.action.targetCard?.id === card.id)
              );

              const isRecentAttacker = !pendingDefense && !interruptWindowState && !!(
                recentOperation &&
                recentOperation.attackerPid === bottomPlayer.pid &&
                recentOperation.attackerCardIds.includes(card.id)
              );
              const isRecentDefender = !pendingDefense && !interruptWindowState && !!(
                recentOperation &&
                recentOperation.defenderPid === bottomPlayer.pid &&
                recentOperation.defenderCardIds.includes(card.id)
              );

              const isAttacker = isAttackerSelection || isAttackerInPendingDefense || isRecentAttacker;
              const isDefender = isDefenderInPendingDefense || isRecentDefender;

              const cardActs = pendingTargetSelection?.actions.filter(a => a.targetId === card.id) || [];
              const hasEligibleAct = cardActs.some(a => !a.disabled);
              const allActsDisabled = cardActs.length > 0 && cardActs.every(a => a.disabled);

              const isOffTurnDef = !isMyTurn && !pendingDefense && !interruptWindowState;
              const offTurnCand = isOffTurnDef ? offTurnInterruptCandidates.find(c => c.card.id === card.id) : null;
              const isOffTurnInterruptEligible = !!offTurnCand && offTurnCand.isReady && offTurnCand.hasEnoughCoins;

              let role: 'attacker' | 'defender' | 'target' | 'buff_target' | undefined = undefined;
              let badge: string | undefined = undefined;
              if (hasEligibleAct) {
                role = 'buff_target';
                badge = '🎯 Beneficiary';
              } else if (allActsDisabled) {
                role = undefined;
                badge = 'Cannot Receive';
              } else if (isOffTurnInterruptEligible) {
                role = 'attacker';
                badge = '⚡ Interrupt Ready';
              } else if (isAttacker) {
                role = 'attacker';
                badge = isAttackerInPendingDefense ? '⚔️ Attacking' : isRecentAttacker ? '⚔️ Attacked' : '⚔️ Attacker';
              } else if (isDefender) {
                role = 'defender';
                badge = isDefenderInPendingDefense ? '🛡️ Defending' : '🛡️ Defended';
              } else if (isTarget) {
                role = 'target';
                badge = '🎯 Target';
              }

              return (
                <CardView
                  key={card.id}
                  card={card}
                  selected={isAttacker || isDefender || isTarget || selectedCard?.id === card.id || hasEligibleAct || isOffTurnInterruptEligible}
                  selectionRole={role}
                  selectionBadge={badge}
                  onClick={(e) => {
                    // 0. If in off-turn defense mode and this card is eligible to trigger Interrupt:
                    if (isOffTurnInterruptEligible && offTurnCand) {
                      handleActivateInterruptFromDefense(card, offTurnCand.action);
                      return;
                    }

                    // If in targeting mode for an operative benefit, direct click selects this operative
                    if (pendingTargetSelection) {
                      const match = pendingTargetSelection.actions.find(a => a.targetId === card.id);
                      if (match) {
                        if (match.disabled) {
                          return;
                        }
                        const allMatchesForThisCard = pendingTargetSelection.actions.filter(a => a.targetId === card.id);
                        if (allMatchesForThisCard.length === 1) {
                          handleAction(match);
                          setPendingTargetSelection(null);
                          return;
                        }
                        // Multiple choices (e.g. +1 OFF vs +1 DEF) - prompt stays open for user to click subchoice
                        return;
                      }
                    }

                    // 1. If currently in defense intercept state and this card belongs to defending player
                    if (pendingDefense && pendingDefense.defender.pid === bottomPlayer.pid && (!isOnline || pendingDefense.defender.pid === myPid)) {
                      if (card.type === 'Operative' && !card.exhausted) {
                        const nextIds = pendingDefense.selectedDefenderIds.includes(card.id)
                          ? pendingDefense.selectedDefenderIds.filter(id => id !== card.id)
                          : [...pendingDefense.selectedDefenderIds, card.id];
                        setPendingDefense({
                          ...pendingDefense,
                          selectedDefenderIds: nextIds
                        });
                      }
                      return;
                    }

                    // 2. If Shift is pressed or card is already an attacker in multi-select mode, or in Interrupt Window:
                    const isShift = e?.shiftKey;
                    if (isShift || isAttacker || selectedAttackers.length > 0 || interruptWindowState) {
                      if (card.type === 'Operative') {
                        if (card.exhausted) {
                          // Exhausted card cannot join attack team
                          return;
                        }
                        if (isAttacker) {
                          const updated = selectedAttackers.filter(a => a.id !== card.id);
                          setSelectedAttackers(updated);
                          if (updated.length === 0) {
                            setSelectedCombatOp(null);
                            setSelectedCombatTarget(null);
                          }
                        } else {
                          const updated = [...selectedAttackers, card];
                          setSelectedAttackers(updated);
                          if (!selectedCombatOp) setSelectedCombatOp('ass');
                        }
                        setSelectedCard(null);
                        setPendingTargetSelection(null);
                        return;
                      }
                    }

                    // 3. Normal single card selection toggle
                    const isToggleOff = selectedCard?.id === card.id;
                    setSelectedCard(isToggleOff ? null : card);
                    if (!isToggleOff && !card.exhausted) {
                      const buffActs = legalActions.filter(a => a.cardId === card.id && a.targetId);
                      if (buffActs.length > 0) {
                        setPendingTargetSelection({
                          sourceCard: card,
                          promptTitle: `${card.name}: Select Target Operative`,
                          promptDescription: `Select which Operative in play will receive the benefit:`,
                          effectType: 'general',
                          actions: buffActs
                        });
                        return;
                      }
                    }
                    setPendingTargetSelection(null);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Player Hand Cards */}
        <div className="border-t border-zinc-800 pt-2">
          {bottomPlayer.hand.length > engine.config.maxHandSize && (
            <div className="mb-2 p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Hand Limit Exceeded ({bottomPlayer.hand.length} / {engine.config.maxHandSize})</span>
                  <span className="ml-1 text-rose-300">
                    — You must discard {bottomPlayer.hand.length - engine.config.maxHandSize} excess card{bottomPlayer.hand.length - engine.config.maxHandSize > 1 ? 's' : ''} of your choice before taking further actions.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-rose-900/90 text-rose-200 px-2 py-0.5 rounded border border-rose-700/60 shrink-0">
                Click Discard Card
              </span>
            </div>
          )}

          {/* Free Deploy Mode Warning Banner */}
          {bottomPlayer.pendingFreeDeploys && bottomPlayer.pendingFreeDeploys.count > 0 && (
            <div className="mb-2 p-2 rounded bg-amber-950/70 border border-amber-500/70 flex items-center justify-between gap-2 shadow-sm animate-pulse">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-[11px] font-mono text-amber-200">
                  <strong>FREE DEPLOY ACTIVE:</strong> Deploy up to {bottomPlayer.pendingFreeDeploys.count} {bottomPlayer.pendingFreeDeploys.cardType === 'any' ? 'card(s) of any type' : `${bottomPlayer.pendingFreeDeploys.cardType} card(s)`} from hand without paying cost ({bottomPlayer.pendingFreeDeploys.sourceCardName}).
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAction({ type: 'FINISH_FREE_DEPLOY', desc: 'Finish free deployment sequence' })}
                className="text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-0.5 rounded border border-zinc-600 shrink-0 font-semibold transition-colors"
              >
                Skip Remaining
              </button>
            </div>
          )}

          <div className="text-[11px] font-mono text-zinc-400 mb-1 flex items-center justify-between">
            <span className={bottomPlayer.hand.length > engine.config.maxHandSize ? 'text-rose-400 font-bold' : ''}>
              Hand ({bottomPlayer.hand.length} / {engine.config.maxHandSize}):
              {bottomPlayer.hand.length > engine.config.maxHandSize && (
                <span className="ml-2 text-[10px] bg-rose-900/80 text-rose-300 border border-rose-700/60 px-1.5 py-0.5 rounded font-normal">
                  Discard {bottomPlayer.hand.length - engine.config.maxHandSize} Excess
                </span>
              )}
            </span>
            <span className="text-[10px] text-zinc-500">
              {bottomPlayer.hand.length > engine.config.maxHandSize
                ? 'Discard excess card(s) to continue operations'
                : bottomPlayer.pendingFreeDeploys && bottomPlayer.pendingFreeDeploys.count > 0
                ? `Free Deploy: Select a card to deploy for 0 coins`
                : isOnline && !isMyTurn ? 'Viewing cards (Opponent turn in progress)' : 'Click card or action below to execute'}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {bottomPlayer.hand.map(card => {
              const mustDiscardExcess = bottomPlayer.hand.length > engine.config.maxHandSize;
              const hasPendingFree = bottomPlayer.pendingFreeDeploys && bottomPlayer.pendingFreeDeploys.count > 0;
              const isCardTypeMatch = hasPendingFree && (bottomPlayer.pendingFreeDeploys!.cardType === 'any' || card.type === bottomPlayer.pendingFreeDeploys!.cardType);
              const effCost = engine.getCardDeployCost(bottomPlayer, card);
              const isAffordable = effCost <= engine.getTotalSpendableCoins(bottomPlayer);

              const isOffTurnDef = !isMyTurn && !pendingDefense && !interruptWindowState;
              const offTurnCand = isOffTurnDef ? offTurnInterruptCandidates.find(c => c.card.id === card.id) : null;
              const isOffTurnInterruptEligible = !!offTurnCand && offTurnCand.hasEnoughCoins;

              const isPlayable = !mustDiscardExcess && (
                ((!isOnline || isMyTurn) && (isCardTypeMatch || (!hasPendingFree && isAffordable))) ||
                isOffTurnInterruptEligible
              );

              return (
                <CardView
                  key={card.id}
                  card={card}
                  isPlayable={isPlayable}
                  playLabel={
                    isOffTurnInterruptEligible
                      ? `⚡ Interrupt (${offTurnCand!.cost}c)`
                      : isCardTypeMatch
                      ? 'Deploy (FREE)'
                      : effCost < card.cost
                      ? `Deploy (${card.cost} -> ${effCost})`
                      : `Deploy (${card.cost})`
                  }
                  onPlay={() => {
                    if (isOffTurnInterruptEligible && offTurnCand) {
                      handleActivateInterruptFromDefense(card, offTurnCand.action);
                      return;
                    }
                    if (isCardTypeMatch) {
                      const freeAct = legalActions.find(a => a.type === 'DEPLOY_FREE_CARD' && a.cardId === card.id) || {
                        type: 'DEPLOY_FREE_CARD',
                        cardId: card.id,
                        cardName: card.name,
                        card,
                        desc: `Deploy ${card.name} for FREE`
                      };
                      handleAction(freeAct);
                      return;
                    }
                    const matchingActs = legalActions.filter(a => a.type === 'PLAY_CARD' && a.cardId === card.id);
                    const targetActs = matchingActs.filter(a => a.targetId);
                    if (targetActs.length > 0) {
                      let title = `Select Operative for ${card.name}`;
                      let desc = `Choose which Operative in play will receive the benefit:`;
                      let effectType: any = 'general';
                      if (card.name === 'Assassination Training') {
                        title = `Train Operative: Assassin Skill (+2 ASS)`;
                        desc = `Select which Operative in play will receive +2 Assassin skill:`;
                        effectType = 'skill_ass';
                      } else if (card.name === 'Raid Training') {
                        title = `Train Operative: Raid Skill (+2 RAID)`;
                        desc = `Select which Operative in play will receive +2 Raid skill:`;
                        effectType = 'skill_raid';
                      } else if (card.name === 'Subterfuge Training') {
                        title = `Train Operative: Subterfuge Skill (+2 SUB)`;
                        desc = `Select which Operative in play will receive +2 Subterfuge skill:`;
                        effectType = 'skill_sub';
                      } else if (card.name === 'Operative Crew' || card.specialAbility === 'operative_crew_intercept' || card.specialAbility === 'assemble_strike_defense') {
                        title = `Operative Crew: Buff Attack or Defense Team`;
                        desc = `Select an Operative in play to receive +2 OFF (Attack Team) or +2 DEF (Defense Team):`;
                        effectType = 'team_buff';
                      } else if (card.name === 'Targeted for Whitewash') {
                        title = `Targeted for Whitewash: Eliminate Operative`;
                        desc = `Select which enemy Operative in play to eliminate:`;
                        effectType = 'elimination';
                      } else if (card.name === 'Double Agent') {
                        title = `Double Agent: Convert Operative`;
                        desc = `Select which enemy Operative in play to convert:`;
                        effectType = 'conversion';
                      } else if (card.name === 'Acquisition') {
                        title = `Acquisition: Acquire Location`;
                        desc = `Select which enemy Location in play to acquire:`;
                        effectType = 'acquisition';
                      }
                      setSelectedCard(card);
                      setPendingTargetSelection({
                        sourceCard: card,
                        promptTitle: title,
                        promptDescription: desc,
                        effectType,
                        actions: targetActs
                      });
                      return;
                    }
                    const act = legalActions.find(a => a.type === 'PLAY_CARD' && a.cardId === card.id);
                    if (act) handleAction(act);
                  }}
                  isDiscardable={mustDiscardExcess && (!isOnline || isMyTurn)}
                  onDiscard={() => {
                    const act = legalActions.find(a => a.type === 'DISCARD_CARD' && a.cardId === card.id) || {
                      type: 'DISCARD_CARD',
                      cardId: card.id,
                      cardName: card.name,
                      card,
                      desc: `Discard ${card.name} to Discard Pile`
                    };
                    handleAction(act);
                  }}
                  selected={selectedCard?.id === card.id || pendingTargetSelection?.sourceCard.id === card.id}
                  onClick={() => {
                    clearCombatSelection();
                    const isToggleOff = selectedCard?.id === card.id;
                    setSelectedCard(isToggleOff ? null : card);
                    if (!isToggleOff) {
                      const matchingActs = legalActions.filter(a => a.type === 'PLAY_CARD' && a.cardId === card.id);
                      const targetActs = matchingActs.filter(a => a.targetId);
                      if (targetActs.length > 0) {
                        let title = `Select Operative for ${card.name}`;
                        let desc = `Choose which Operative in play will receive the benefit:`;
                        let effectType: any = 'general';
                        if (card.name === 'Assassination Training') {
                          title = `Train Operative: Assassin Skill (+2 ASS)`;
                          desc = `Select which Operative in play will receive +2 Assassin skill:`;
                          effectType = 'skill_ass';
                        } else if (card.name === 'Raid Training') {
                          title = `Train Operative: Raid Skill (+2 RAID)`;
                          desc = `Select which Operative in play will receive +2 Raid skill:`;
                          effectType = 'skill_raid';
                        } else if (card.name === 'Subterfuge Training') {
                          title = `Train Operative: Subterfuge Skill (+2 SUB)`;
                          desc = `Select which Operative in play will receive +2 Subterfuge skill:`;
                          effectType = 'skill_sub';
                        } else if (card.name === 'Targeted for Whitewash') {
                          title = `Targeted for Whitewash: Eliminate Operative`;
                          desc = `Select which enemy Operative in play to eliminate:`;
                          effectType = 'elimination';
                        } else if (card.name === 'Double Agent') {
                          title = `Double Agent: Convert Operative`;
                          desc = `Select which enemy Operative in play to convert:`;
                          effectType = 'conversion';
                        } else if (card.name === 'Acquisition') {
                          title = `Acquisition: Acquire Location`;
                          desc = `Select which enemy Location in play to acquire:`;
                          effectType = 'acquisition';
                        }
                        setPendingTargetSelection({
                          sourceCard: card,
                          promptTitle: title,
                          promptDescription: desc,
                          effectType,
                          actions: targetActs
                        });
                        return;
                      }
                    }
                    setPendingTargetSelection(null);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* INTERRUPT SPECIAL ABILITY WINDOW (SEIZED INITIATIVE & COUNTER-ATTACK) */}
      {interruptWindowState && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-950/90 via-amber-950/80 to-zinc-950 border-2 border-yellow-500 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-500/40 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                <Zap className="w-5 h-5 fill-current animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-yellow-300">
                    ⚡ INTERRUPT SEIZURE: {interruptWindowState.defender.name.toUpperCase()} HAS INITIATIVE!
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-500/40 uppercase">
                    Off-Turn Interrupt Window
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-mono">
                  {interruptWindowState.suspendedDefense ? (
                    <>
                      {interruptWindowState.attacker.name}'s attack with <strong className="text-red-300">{interruptWindowState.suspendedDefense.attackerNames}</strong> has been <strong className="text-yellow-400">HALTED &amp; SUSPENDED</strong> via <strong className="text-yellow-300">{interruptWindowState.sourceCard.name}</strong>!
                    </>
                  ) : (
                    <>
                      {interruptWindowState.attacker.name}'s turn has been <strong className="text-yellow-400">HALTED &amp; STOPPED</strong> via <strong className="text-yellow-300">{interruptWindowState.sourceCard.name}</strong>!
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReturnInitiativeFromInterrupt}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-bold text-xs border border-zinc-600 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <span>↩️ Return Initiative to {interruptWindowState.attacker.name}</span>
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/60 border border-yellow-500/30 text-xs font-mono space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-200">
                👉 Select your ready Operatives below to <strong>launch a Counter-Attack Operation</strong> against {interruptWindowState.attacker.name}, or resolve additional abilities.
              </span>
              <span className="text-[11px] text-yellow-400">
                Ready Operatives: {interruptWindowState.defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted).length}
              </span>
            </div>

            {selectedAttackers.length === 0 ? (
              <div className="p-2 rounded bg-yellow-950/40 border border-yellow-600/30 text-[11px] text-yellow-200 flex items-center justify-between">
                <span>Click any friendly Operative to assemble a Counter-Attack team!</span>
                <span className="text-[10px] text-zinc-400">Combat Planner will appear below</span>
              </div>
            ) : (
              <div className="p-2 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 flex items-center justify-between">
                <span>
                  ⚔️ Counter-Attack Team Assembled: <strong>{selectedAttackers.map(a => a.name).join(' + ')}</strong>
                </span>
                <span className="text-[10px] text-emerald-400">Configure Operation in Combat Planner below!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMBAT PLANNER INTERFACE (MULTI-SELECT OPERATIVES) */}
      {selectedAttackers.length > 0 && (
        <CombatPlanner
          engine={engine}
          attackerPlayer={interruptWindowState ? interruptWindowState.defender : bottomPlayer}
          defenderPlayer={interruptWindowState ? interruptWindowState.attacker : topPlayer}
          selectedAttackers={selectedAttackers}
          selectedTarget={selectedCombatTarget}
          selectedOperation={selectedCombatOp}
          onSelectOperation={(op) => setSelectedCombatOp(op)}
          onSelectTarget={(target) => setSelectedCombatTarget(target)}
          onClearAttackers={clearCombatSelection}
          onExecuteAttack={handleExecuteMultiAttack}
          onDeployOperativeCrew={handleDeployOperativeCrew}
          disabled={!isMyTurn && !interruptWindowState}
        />
      )}

      {/* INLINE DEFENSE INTERCEPT PANEL (NO POP-UP WINDOW) */}
      {pendingDefense && (
        <InlineDefensePanel
          engine={engine}
          attacker={pendingDefense.attacker}
          defender={pendingDefense.defender}
          threatType={pendingDefense.threatType}
          threatName={pendingDefense.threatName}
          incomingAttack={pendingDefense.incomingAttack}
          attackerNames={pendingDefense.attackerNames}
          targetCard={pendingDefense.action.targetCard || null}
          readyOps={pendingDefense.readyOps}
          selectedDefenderIds={pendingDefense.selectedDefenderIds}
          onToggleDefender={(cardId) => {
            const nextIds = pendingDefense.selectedDefenderIds.includes(cardId)
              ? pendingDefense.selectedDefenderIds.filter(id => id !== cardId)
              : [...pendingDefense.selectedDefenderIds, cardId];
            const updatedReadyOps = pendingDefense.defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
            setPendingDefense({
              ...pendingDefense,
              readyOps: updatedReadyOps,
              selectedDefenderIds: nextIds
            });
          }}
          onConfirmDefense={handleConfirmDefense}
          onDeclineDefense={() => handleConfirmDefense([])}
          isOnlinePeerWaiting={isOnline && pendingDefense.defender.pid !== myPid}
          isSpecialAbilityAttack={pendingDefense.isSpecialAbilityAttack}
          onActivateInterrupt={handleActivateInterruptFromDefense}
        />
      )}

      {/* INLINE OPERATIVE TARGET SELECTION PANEL */}
      {pendingTargetSelection && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-zinc-950/95 to-zinc-900 border-2 border-emerald-500/80 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
                <Target className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{pendingTargetSelection.promptTitle}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                    Source: {pendingTargetSelection.sourceCard.name}
                  </span>
                </h4>
                <p className="text-xs text-zinc-300">
                  {pendingTargetSelection.promptDescription} <span className="text-emerald-400 font-semibold">(Click an Operative below or on the battlefield)</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setPendingTargetSelection(null);
                setSelectedCard(null);
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors flex items-center gap-1"
            >
              ✕ Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {Array.from(new Set(pendingTargetSelection.actions.map(a => a.targetId))).map(targetId => {
              const targetCard = engine.players.flatMap(p => p.battlefield).find(c => c.id === targetId);
              if (!targetCard) return null;

              const candidateActs = pendingTargetSelection.actions.filter(a => a.targetId === targetId);
              const allDisabled = candidateActs.every(a => a.disabled);
              const disabledReason = candidateActs.find(a => a.disabled)?.disabledReason;

              const totalOff = (targetCard.off || 1) + engine.getCardStatTokensBuff(targetCard) + (targetCard.tempOffenseBuff || 0);
              const totalDef = (targetCard.def || 1) + engine.getCardStatTokensBuff(targetCard) + (targetCard.tempDefenseBuff || 0);

              return (
                <div
                  key={targetId}
                  className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                    allDisabled
                      ? 'bg-zinc-900/40 border-zinc-800/50 opacity-60'
                      : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-emerald-500/50 hover:border-emerald-400 shadow-md hover:shadow-emerald-500/20'
                  }`}
                >
                  <div className="space-y-1.5 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        {targetCard.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {targetCard.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-rose-400 flex items-center gap-1">
                        <Sword className="w-3 h-3" /> OFF: {totalOff}
                      </span>
                      <span className="text-blue-400 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> DEF: {totalDef}
                      </span>
                      {targetCard.techTokens ? (
                        <span className="text-cyan-300 text-[10px] bg-cyan-950/80 border border-cyan-500/40 px-1 rounded">
                          Tech +{targetCard.techTokens}
                        </span>
                      ) : null}
                      {Math.max(targetCard.powerArmorTokens || 0, targetCard.poweredArmorTokens || 0) > 0 ? (
                        <span className="text-emerald-300 text-[10px] bg-emerald-950/80 border border-emerald-500/40 px-1 rounded">
                          Power Armor +{Math.max(targetCard.powerArmorTokens || 0, targetCard.poweredArmorTokens || 0)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                      <span>ASS: {targetCard.ass || 0}</span>
                      <span>•</span>
                      <span>RAID: {targetCard.raid || 0}</span>
                      <span>•</span>
                      <span>SUB: {targetCard.sub || 0}</span>
                    </div>

                    {allDisabled && disabledReason && (
                      <p className="text-[11px] text-rose-400/90 italic mt-1 bg-rose-950/40 border border-rose-800/40 rounded p-1">
                        ⚠️ {disabledReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800/80">
                    {candidateActs.map((act, actIdx) => (
                      <button
                        key={actIdx}
                        disabled={act.disabled}
                        onClick={() => {
                          if (!act.disabled) {
                            handleAction(act);
                            setPendingTargetSelection(null);
                          }
                        }}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                          act.disabled
                            ? 'bg-zinc-800/60 text-zinc-500 cursor-not-allowed border border-zinc-800 opacity-60'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md border border-emerald-400/50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>
                            {act.subChoice === 'buff_ass' || act.subChoice === 'token_ass' || act.subChoice === 'ass' ? '🗡️ +1 Assassination Skill' :
                             act.subChoice === 'buff_raid' || act.subChoice === 'token_raid' || act.subChoice === 'raid' ? '💰 +1 Raid Skill' :
                             act.subChoice === 'buff_sub' || act.subChoice === 'token_sub' || act.subChoice === 'sub' ? '🕵️ +1 Subterfuge Skill' :
                             act.subChoice === 'buff_off' ? 'Select: +1 Offense' :
                             act.subChoice === 'buff_def' ? 'Select: +1 Defense' :
                             act.subChoice === 'buff_attack_team' ? 'Give +2 OFF to Attack Team' :
                             act.subChoice === 'buff_defense_team' ? 'Give +2 DEF to Defense Team' :
                             act.subChoice === 'assemble_strike' ? 'Give +2 Offense' :
                             act.subChoice === 'assemble_defense' ? 'Give +2 Defense' :
                             act.subChoice === 'buff_tech_token' || act.subChoice === 'token_tech' ? `💻 +1/+1 Tech Token` :
                             act.subChoice === 'token_weapon' ? `🔫 +1/+1 Weapon Token` :
                             act.subChoice === 'token_suit' ? `🥋 +1/+1 Suit Token` :
                             act.subChoice === 'token_power_armor' || act.subChoice === 'token_powered_armor' ? `🛡️ +1/+1 Power Armor Token` :
                             act.subChoice === 'token_power_suit' ? `🦾 +1/+1 Power Suit Token` :
                             act.subChoice === 'token_discard' ? `🗑️ Discard Token` :
                             act.desc.includes('[') && act.desc.includes(']') ? `Select: ${act.desc.substring(act.desc.indexOf('[') + 1, act.desc.lastIndexOf(']'))}` :
                             `Select ${targetCard.name}`}
                          </span>
                          {act.disabled && (
                            <span className="text-[10px] text-rose-300/80 font-normal">
                              ({act.disabledReason || 'Unavailable'})
                            </span>
                          )}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTION SELECTOR MENU */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <ChevronRight className="w-4 h-4 text-amber-400" />
              Legal Turn Action Menu ({legalActions.length} choices)
            </span>
            {selectedCard && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] text-amber-300">
                <span>Filtered by: <strong>{selectedCard.name}</strong></span>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="ml-1 text-zinc-400 hover:text-white hover:bg-zinc-800 px-1 rounded transition-colors"
                  title="Clear filter"
                >
                  ✕ Show All
                </button>
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {isOnline ? 'Real-time peer synchronized actions' : 'Generated discrete ISMCTS decision branches'}
          </span>
        </div>

        {isOnline && multiplayerRoom?.status === 'waiting' ? (
          <div className="py-6 text-center text-xs font-mono text-zinc-400 flex flex-col items-center justify-center gap-2 bg-zinc-950/60 rounded-lg border border-zinc-800">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <p className="text-zinc-200 font-semibold">Match Waiting Room</p>
            <p className="text-zinc-500 text-[11px]">Send the room code to your friend to begin your online espionage battle.</p>
          </div>
        ) : !isGameStarted && !isOnline ? (
          <div className="py-6 text-center text-xs font-mono text-zinc-400 flex flex-col items-center justify-center gap-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              <span className="text-zinc-200 font-semibold text-sm">Match Initialized &mdash; Ready to Play</span>
            </div>
            <p className="text-zinc-400 text-xs max-w-md">
              <strong className="text-amber-300">{activePlayer.name} ({activePlayer.pid})</strong> has initiative for Round {engine.currentRound || 1}.
              {activePlayer.isAI
                ? ' The AI is on standby and will wait for you to click Start before playing.'
                : ' You have initiative! Review the table, plan your moves, and click Start to begin.'}
            </p>
            <button
              id="btn-start-game-deck-panel"
              onClick={handleStartGame}
              className="mt-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 border border-emerald-400/50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Match
            </button>
          </div>
        ) : !isMyTurn ? (
          <div className="py-6 text-center text-xs font-mono text-zinc-400 flex flex-col items-center justify-center gap-2 bg-zinc-950/60 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-zinc-200 font-semibold">{topPlayer.name} Turn in Progress</span>
            </div>
            <p className="text-zinc-500 text-[11px]">Awaiting {topPlayer.name}&apos;s operational command...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {legalActions.map((action, idx) => (
              <button
                key={idx}
                disabled={action.disabled}
                onClick={() => !action.disabled && handleAction(action)}
                title={action.disabledReason || action.desc}
                className={`p-2 rounded-lg text-left text-xs transition-all group flex items-start gap-2 ${
                  action.disabled
                    ? 'bg-zinc-950/40 border border-zinc-800/40 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                  action.disabled 
                    ? 'bg-zinc-900 text-zinc-600' 
                    : 'bg-zinc-800 text-zinc-400 group-hover:bg-amber-500/20 group-hover:text-amber-300'
                }`}>
                  {idx + 1}
                </span>
                <span className={`${action.disabled ? 'text-zinc-500 italic' : 'text-zinc-300 group-hover:text-white'} leading-snug line-clamp-2`}>
                  {action.desc}
                </span>
              </button>
            ))}
            {legalActions.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-zinc-500 italic">
                No legal actions available. You may pass your turn.
              </div>
            )}
          </div>
        )}
      </div>

      {/* CHESS-STYLE ALGEBRAIC LOG STREAM */}
      <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono border-b border-zinc-800 pb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Match Notation &amp; Event Log Stream</span>
            <button
              onClick={handleDownloadLog}
              className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700 flex items-center gap-1 transition-colors"
              title="Download Log Stream as .txt file"
            >
              <Download className="w-3 h-3" />
              Download Log
            </button>
          </div>
          <span className="text-[11px] text-zinc-500">Round.Action.PlayerID: [CODE] Details [Coins: Total (Turn: X, Stored: Y)]</span>
        </div>
        <div className="max-h-44 overflow-y-auto font-mono text-xs space-y-1 pt-1 select-text">
          {engine.logs.map(log => (
            <div key={log.id} className="text-zinc-300 flex items-start gap-1.5 leading-snug">
              <span className="text-zinc-500 shrink-0">
                {log.round}.{log.actionNumber}.{log.pid}:
              </span>
              <span className={`font-bold shrink-0 ${
                log.code.includes('THWART') ? 'text-emerald-400' :
                log.code.includes('WIN') || log.code.includes('CLAIM') ? 'text-amber-300' :
                log.code.includes('ASS') || log.code.includes('WHITEWASH') ? 'text-rose-400' :
                log.code.includes('RAID') || log.code.includes('SIPHON') ? 'text-amber-400' :
                'text-cyan-400'
              }`}>
                [{log.code}]
              </span>
              <span className="text-zinc-200">{log.details}</span>
              <span className="text-zinc-500 ml-auto shrink-0 text-[11px]">{log.balanceStr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 8-SETTING GAME CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-zinc-100 font-mono">Game Settings &amp; Simulation Parameters</h2>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm px-2 py-1 rounded bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 1. Rounds to simulate (1 - 10) [Default: 5] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">1. Rounds to simulate</span>
                  <p className="text-zinc-400 text-[11px]">Range: 1 - 10 (Default: 5)</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={engine.config.rounds}
                  onChange={(e) => {
                    engine.config.rounds = Math.max(1, Math.min(10, parseInt(e.target.value) || 5));
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 2. Cards drawn per turn (1 - 5) [Default: 2] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">2. Cards drawn per turn</span>
                  <p className="text-zinc-400 text-[11px]">Range: 1 - 5 (Default: 2)</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={engine.config.cardsDrawnPerTurn}
                  onChange={(e) => {
                    engine.config.cardsDrawnPerTurn = Math.max(1, Math.min(5, parseInt(e.target.value) || 2));
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 3. Maximum hand size limit (1 - 10) [Default: 5] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">3. Maximum hand size limit</span>
                  <p className="text-zinc-400 text-[11px]">Range: 1 - 10 (Default: 5)</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={engine.config.maxHandSize}
                  onChange={(e) => {
                    engine.config.maxHandSize = Math.max(1, Math.min(10, parseInt(e.target.value) || 5));
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 4. Points to win (0 = play all rounds, >0 = sudden death) [Default: 0] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">4. Points to win (Sudden Death)</span>
                  <p className="text-zinc-400 text-[11px]">0 = play all rounds, &gt;0 = threshold (Default: 0)</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={engine.config.pointsToWin}
                  onChange={(e) => {
                    engine.config.pointsToWin = Math.max(0, parseInt(e.target.value) || 0);
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 5. Affiliation coin storage cap (1 - 20) [Default: 5] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">5. Affiliation coin storage cap</span>
                  <p className="text-zinc-400 text-[11px]">Range: 1 - 20 (Default: 5)</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={engine.config.affiliationMaxCap}
                  onChange={(e) => {
                    const cap = Math.max(1, Math.min(20, parseInt(e.target.value) || 5));
                    engine.config.affiliationMaxCap = cap;
                    engine.players.forEach(p => {
                      if (p.affiliation) p.affiliation.cap = cap;
                    });
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 6. Operative summon state: Ready or Exhausted? (R/E) [Default: R] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">6. Operative summon state</span>
                  <p className="text-zinc-400 text-[11px]">Ready (R) or Exhausted (E) [Default: R]</p>
                </div>
                <div className="flex items-center bg-zinc-900 p-1 rounded border border-zinc-700">
                  <button
                    onClick={() => { engine.config.operativeSummonState = 'R'; onRefresh(); }}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                      engine.config.operativeSummonState === 'R'
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    R (Ready)
                  </button>
                  <button
                    onClick={() => { engine.config.operativeSummonState = 'E'; onRefresh(); }}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                      engine.config.operativeSummonState === 'E'
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    E (Exhausted)
                  </button>
                </div>
              </div>

              {/* 7. Location summon state: Ready or Exhausted? (R/E) [Default: R] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">7. Location summon state</span>
                  <p className="text-zinc-400 text-[11px]">Ready (R) or Exhausted (E) [Default: R]</p>
                </div>
                <div className="flex items-center bg-zinc-900 p-1 rounded border border-zinc-700">
                  <button
                    onClick={() => { engine.config.locationSummonState = 'R'; onRefresh(); }}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                      engine.config.locationSummonState === 'R'
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    R (Ready)
                  </button>
                  <button
                    onClick={() => { engine.config.locationSummonState = 'E'; onRefresh(); }}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                      engine.config.locationSummonState === 'E'
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    E (Exhausted)
                  </button>
                </div>
              </div>

              {/* 8. Starting Mission Cards (1 - 10) [Default: 1] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">8. Starting Mission Cards</span>
                  <p className="text-zinc-400 text-[11px]">Range: 1 - 10 (Default: 1)</p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={engine.config.startingMissionCards}
                  onChange={(e) => {
                    engine.config.startingMissionCards = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 9. Maximum Mission Cards in Play (1 - 10) [Default: 0 - No maximum] */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div>
                  <span className="font-semibold text-zinc-200">9. Maximum Mission Cards in Play</span>
                  <p className="text-zinc-400 text-[11px]">Range: 1 - 10 (0 = No maximum limit) [Default: 0]</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={engine.config.maxMissionsInPlay}
                  onChange={(e) => {
                    engine.config.maxMissionsInPlay = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                    onRefresh();
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-center font-mono text-amber-400 font-bold"
                />
              </div>

              {/* 10. Initiative Rule (Option 1: Highest Prod, Option 2: Lowest Prod, Option 3: Random) */}
              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-200">10. Initiative Rule</span>
                    <p className="text-zinc-400 text-[11px]">Who plays first in Round 1</p>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                    {(engine.config.initiativeRule || 'HIGHEST_PROD') === 'HIGHEST_PROD' ? 'Highest' : engine.config.initiativeRule === 'LOWEST_PROD' ? 'Lowest' : 'Random'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => {
                      engine.config.initiativeRule = 'HIGHEST_PROD';
                      onRefresh();
                    }}
                    className={`px-2 py-1.5 rounded text-xs font-mono transition-all text-center ${
                      (engine.config.initiativeRule || 'HIGHEST_PROD') === 'HIGHEST_PROD'
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    1. Highest (Default)
                  </button>
                  <button
                    onClick={() => {
                      engine.config.initiativeRule = 'LOWEST_PROD';
                      onRefresh();
                    }}
                    className={`px-2 py-1.5 rounded text-xs font-mono transition-all text-center ${
                      engine.config.initiativeRule === 'LOWEST_PROD'
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    2. Lowest Prod
                  </button>
                  <button
                    onClick={() => {
                      engine.config.initiativeRule = 'RANDOM';
                      onRefresh();
                    }}
                    className={`px-2 py-1.5 rounded text-xs font-mono transition-all text-center ${
                      engine.config.initiativeRule === 'RANDOM'
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    3. Random Coin
                  </button>
                </div>
              </div>

              {/* 11. AI Skill & ISMCTS Monte Carlo Tree Branches (Levels 1 - 10) */}
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    <div>
                      <span className="font-semibold text-zinc-200">11. AI Skill &amp; ISMCTS Branch Depth</span>
                      <p className="text-zinc-400 text-[11px]">Monte Carlo Tree Search exploration branches per turn</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${currentDiffConfig.colorClass}`}>
                    {currentDiffConfig.emoji} Lv.{currentDiffConfig.level} {currentDiffConfig.name} ({currentDiffConfig.iterations} br)
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px] bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                  {currentDiffConfig.description}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                  {AI_DIFFICULTY_LEVELS.map(lvl => (
                    <button
                      key={lvl.level}
                      type="button"
                      onClick={() => {
                        setAiDifficulty(lvl.level);
                        try { localStorage.setItem('spywar_ai_difficulty', String(lvl.level)); } catch {}
                      }}
                      className={`px-1.5 py-1.5 rounded text-[11px] font-mono transition-all text-center border ${
                        aiDifficulty === lvl.level
                          ? 'bg-indigo-600 text-white font-bold border-indigo-400 shadow-sm ring-1 ring-indigo-400/40'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {lvl.emoji} Lv.{lvl.level} {lvl.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* 12. Skill Token Stacking Rule */}
              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-200">12. Skill Token Stacking</span>
                    <p className="text-zinc-400 text-[11px]">Allow stacking of Assassination, Raid, and Subterfuge skill tokens</p>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                    {engine.config.allowDuplicateSkillTokens ? 'Stacking Allowed' : 'No Duplicates'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      engine.config.allowDuplicateSkillTokens = true;
                      onRefresh();
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-mono transition-all text-center ${
                      engine.config.allowDuplicateSkillTokens
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    1. Allow Stacking (Standard Rule)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      engine.config.allowDuplicateSkillTokens = false;
                      onRefresh();
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-mono transition-all text-center ${
                      !engine.config.allowDuplicateSkillTokens
                        ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
                    }`}
                  >
                    2. Disallow Duplicate Skills
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                onClick={() => {
                  engine.config = { ...DEFAULT_CONFIG };
                  CardDatabaseService.getInstance().resetGameConfig();
                  engine.players.forEach(p => {
                    if (p.affiliation) p.affiliation.cap = DEFAULT_CONFIG.affiliationMaxCap;
                  });
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors"
              >
                Reset to Defaults
              </button>

              <button
                onClick={() => {
                  CardDatabaseService.getInstance().saveGameConfig(engine.config);
                  setShowConfigModal(false);
                  handleResetGame();
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono shadow-md transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Apply &amp; Restart Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONLINE MULTIPLAYER LOBBY MODAL */}
      <MultiplayerLobbyModal
        isOpen={showLobbyModal}
        onClose={() => {
          setShowLobbyModal(false);
          if (!multiplayerRoom) {
            setGameMode('human_vs_ai');
          }
        }}
        config={engine.config}
        initialRoomCode={initialJoinCode}
        onRoomJoined={handleRoomJoined}
      />
    </div>
  );
};
