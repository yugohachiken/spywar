import React, { useState, useEffect, useRef } from 'react';
import { SpywarEngine, DEFAULT_CONFIG } from '../engine/SpywarEngine';
import { ISMCTSAgent } from '../engine/ISMCTSAgent';
import { CardView } from './CardView';
import { Action, Card, GameMode, Player, MultiplayerRoomDoc, RoomDefenseData } from '../types/spywar';
import { Play, RotateCcw, Bot, Shield, Coins, Sparkles, ChevronRight, Activity, User, Users, Pause, Download, SlidersHorizontal, Check, AlertTriangle, Globe, Copy, Link as LinkIcon, Loader2, LogOut, ZoomIn, Layers, Zap } from 'lucide-react';
import { MultiplayerLobbyModal } from './MultiplayerLobbyModal';
import { CombatPlanner, CombatOperationType } from './CombatPlanner';
import { InlineDefensePanel } from './InlineDefensePanel';
import { subscribeToMultiplayerRoom, syncRoomState, deleteMultiplayerRoom } from '../services/multiplayerService';
import { useCardZoom } from '../context/CardZoomContext';
import { CardDatabaseService } from '../services/cardDatabaseService';

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

interface GameBoardProps {
  engine: SpywarEngine;
  onRefresh: () => void;
  onNavigateToDeckBuilder?: () => void;
  onNavigateToCardEditor?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ engine, onRefresh, onNavigateToDeckBuilder, onNavigateToCardEditor }) => {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedAttackers, setSelectedAttackers] = useState<Card[]>([]);
  const [selectedCombatOp, setSelectedCombatOp] = useState<CombatOperationType | null>(null);
  const [selectedCombatTarget, setSelectedCombatTarget] = useState<Card | null>(null);
  const { setHighlightedItem, clearHighlightedItem, openZoom, highlightedItem } = useCardZoom();
  const [aiThinking, setAiThinking] = useState(false);
  const [autoAi, setAutoAi] = useState(true);
  const [gameMode, setGameMode] = useState<GameMode>('human_vs_ai');
  const [aiSpeed, setAiSpeed] = useState<number>(450); // ms delay between AI actions
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingDefense, setPendingDefense] = useState<PendingDefenseState | null>(null);
  const autoAiTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const bottomPlayer = isOnline
    ? (myPid === 'P2' ? engine.players[1] : engine.players[0])
    : activePlayer;

  const topPlayer = isOnline
    ? (myPid === 'P2' ? engine.players[0] : engine.players[1])
    : opponent;

  const isMyTurn = isOnline
    ? (activePlayer.pid === myPid && multiplayerRoom?.status === 'playing')
    : (!activePlayer.isAI);

  const myPlayer = isOnline
    ? bottomPlayer
    : (activePlayer.isAI ? opponent : activePlayer);
  const otherPlayer = isOnline
    ? topPlayer
    : (activePlayer.isAI ? activePlayer : opponent);

  const interruptActions = engine.getInterruptActions(myPlayer, otherPlayer);

  const baseLegalActions = isOnline
    ? (isMyTurn ? engine.getLegalActions(bottomPlayer, topPlayer, selectedCard) : [])
    : engine.getLegalActions(activePlayer, opponent, selectedCard);

  const legalActions = isMyTurn
    ? [...baseLegalActions, ...interruptActions.filter(ia => !baseLegalActions.some(ba => ba.cardId === ia.cardId && ba.desc === ia.desc))]
    : [];

  const mctsAgent = useRef(new ISMCTSAgent(engine.config.rounds * 10)).current;

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
          const recommended = engine.selectAiDefenders(defender, defData.threatType, defData.incomingAttack);

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
    };
  }, []);

  // Auto-play watchdog effect
  useEffect(() => {
    if (autoAi && !engine.gameOver && !aiThinking) {
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
  }, [autoAi, engine.activePlayerIndex, engine.actionCounter, engine.gameOver, aiThinking, aiSpeed]);

  const isAttackAction = (action: Action): boolean => {
    if (action.type === 'DAN_WEAK_SACRIFICE') return true;
    if (action.type === 'OPERATIVE_ACTION') {
      return ['ass', 'sub', 'raid', 'boksoon_ass', 'mata_hari_steal', 'ghost_siphon'].includes(action.opType || '');
    }
    if (action.type === 'DYNAMIC_ABILITY' && (action.dynamicAbilityEffect?.effect?.type === 'exhaust_card' || action.isSpecialAbilityAttack)) {
      return true;
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

    if (action.type === 'DAN_WEAK_SACRIFICE') {
      const threatType: 'ass' | 'sub' | 'raid' = action.subChoice === 'discard_hand' ? 'sub' : 'ass';
      const op = action.card!;
      const skill = threatType === 'ass' ? (op.ass || 2) : (op.sub || 2);
      return {
        threatType,
        threatName: threatType === 'ass' ? 'Assassination Sacrifice' : 'Subterfuge Sacrifice',
        attackPower: (op.off || 4) + (op.techTokens || 0) + (op.tempOffenseBuff || 0) + skill,
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'boksoon_ass') {
      const op = action.card!;
      return {
        threatType: 'ass' as const,
        threatName: 'Boksoon Targeted Execution',
        attackPower: (op.off || 4) + (op.techTokens || 0) + (op.tempOffenseBuff || 0) + (op.ass || 3),
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'mata_hari_steal') {
      const op = action.card!;
      return {
        threatType: 'sub' as const,
        threatName: 'Mata Hari Hand Infiltration',
        attackPower: (op.off || 3) + (op.techTokens || 0) + (op.tempOffenseBuff || 0) + (op.sub || 3),
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'ghost_siphon') {
      const op = action.card!;
      return {
        threatType: 'raid' as const,
        threatName: 'Ghost Resource Siphon',
        attackPower: (op.off || 3) + (op.techTokens || 0) + (op.tempOffenseBuff || 0) + (op.raid || 3),
        attackerNames: op.name,
        isSpecialAbilityAttack
      };
    }

    if (action.opType === 'ass') {
      let atk = 0;
      for (const a of attackers) {
        atk += (a.off || 1) + (a.techTokens || 0) + (a.ass || 0) + (a.tempOffenseBuff || 0);
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
        atk += (a.off || 1) + (a.techTokens || 0) + (a.raid || 0) + (a.tempOffenseBuff || 0);
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
        atk += (a.off || 1) + (a.techTokens || 0) + (a.sub || 0) + (a.tempOffenseBuff || 0);
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

  const executeAiStep = () => {
    if (engine.gameOver || pendingDefense) return;
    const currentActive = engine.getActivePlayer();
    const currentOpp = engine.getOpponent();

    setAiThinking(true);
    setTimeout(() => {
      try {
        const bestAction = mctsAgent.getBestAction(engine, currentActive, currentOpp);
        
        // If AI is attacking a human player who has Ready operatives, trigger defense assignment prompt!
        if (isAttackAction(bestAction) && !currentOpp.isAI) {
          const readyOps = currentOpp.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
          if (readyOps.length > 0) {
            setAutoAi(false);
            const attackInfo = getIncomingAttackInfo(bestAction);
            const recommended = engine.selectAiDefenders(currentOpp, attackInfo.threatType, attackInfo.attackPower);
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

  const handleExecuteMultiAttack = () => {
    if (selectedAttackers.length === 0 || !selectedCombatOp) return;

    let action: Action;
    const attackerCards = [...selectedAttackers];
    const firstOp = attackerCards[0];

    if (selectedCombatOp === 'ass') {
      if (!selectedCombatTarget) return;
      let totalOff = 0;
      for (const a of attackerCards) {
        totalOff += (a.off || 1) + (a.techTokens || 0) + (a.ass || 0) + (a.tempOffenseBuff || 0);
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
        totalOff += (a.off || 1) + (a.techTokens || 0) + (a.raid || 0) + (a.tempOffenseBuff || 0);
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
        totalOff += (a.off || 1) + (a.techTokens || 0) + (a.sub || 0) + (a.tempOffenseBuff || 0);
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
    if (pendingDefense) return;

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
        const readyOps = opponent.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
        if (readyOps.length > 0) {
          const attackInfo = getIncomingAttackInfo(action);
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

    // If attacking human opponent (e.g. Pass & Play mode) who has Ready operatives, allow defense assignment
    if (isAttackAction(action) && !opponent.isAI) {
      const readyOps = opponent.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
      if (readyOps.length > 0) {
        const attackInfo = getIncomingAttackInfo(action);
        const recommended = engine.selectAiDefenders(opponent, attackInfo.threatType, attackInfo.attackPower);
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

    engine.executeAction(activePlayer, opponent, action);
    setSelectedCard(null);
    onRefresh();
  };

  const handleConfirmDefense = (chosenDefenderIds: string[], bonusDefense: number = 0) => {
    if (!pendingDefense) return;
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

  // Manual Trigger: executes exactly 1 AI action and pauses so the user can inspect
  const handleManualTriggerAi = () => {
    if (engine.gameOver || aiThinking || pendingDefense) return;
    executeAiStep();
  };

  const handleResetGame = () => {
    const shouldAuto = gameMode === 'human_vs_ai' || gameMode === 'ai_vs_ai';
    setAutoAi(shouldAuto);
    if (autoAiTimerRef.current) clearTimeout(autoAiTimerRef.current);
    setPendingDefense(null);
    clearCombatSelection();

    const cardDb = CardDatabaseService.getInstance();
    const deckData = cardDb.generateGameDeckForEngine();
    engine.setupGame({
      ...deckData,
      deckName: cardDb.getActiveDeck().name,
    });
    engine.setGameMode(gameMode);
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
          {/* SPEED CONTROL (Shown when Auto-play is active or in AI vs AI mode) */}
          {(autoAi || gameMode === 'ai_vs_ai') && (
            <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 font-mono">
              <span>Speed:</span>
              {[
                { label: '1x', ms: 550 },
                { label: '2x', ms: 250 },
                { label: 'Fast', ms: 100 },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => setAiSpeed(s.ms)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${aiSpeed === s.ms ? 'bg-zinc-700 text-amber-300 font-bold' : 'hover:text-zinc-200'}`}
                >
                  {s.label}
                </button>
              ))}
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
            title="Reset Match"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
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

        {/* AI Action Status Banner */}
        {activePlayer.isAI && !engine.gameOver && (
          <div className="flex items-center gap-2">
            {autoAi ? (
              <span className="text-indigo-300 text-[11px] font-mono flex items-center gap-1.5 animate-pulse">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                AI ({activePlayer.pid}) is executing turn...
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
        )}
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
          {topPlayer.affiliation && (
            <CardView
              card={topPlayer.affiliation}
              compact
              selected={selectedCombatTarget?.id === topPlayer.affiliation.id || selectedCard?.id === topPlayer.affiliation.id}
              selectionRole={
                selectedCombatTarget?.id === topPlayer.affiliation.id
                  ? 'target'
                  : undefined
              }
              selectionBadge={
                selectedCombatTarget?.id === topPlayer.affiliation.id
                  ? 'Target'
                  : undefined
              }
              onClick={() => {
                if (selectedAttackers.length > 0) {
                  setSelectedCombatTarget(selectedCombatTarget?.id === topPlayer.affiliation.id ? null : topPlayer.affiliation);
                } else {
                  setSelectedCard(selectedCard?.id === topPlayer.affiliation.id ? null : topPlayer.affiliation);
                }
              }}
            />
          )}
          {topPlayer.battlefield.map(card => {
            const isTarget = selectedCombatTarget?.id === card.id;
            const isDefender = pendingDefense?.selectedDefenderIds.includes(card.id) && pendingDefense.defender.pid === topPlayer.pid;
            return (
              <CardView
                key={card.id}
                card={card}
                compact
                selected={isTarget || isDefender || selectedCard?.id === card.id}
                selectionRole={isTarget ? 'target' : isDefender ? 'defender' : undefined}
                selectionBadge={isTarget ? 'Target' : isDefender ? 'Defender' : undefined}
                onClick={() => {
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
                    setSelectedCombatTarget(isTarget ? null : card);
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
              disabled={isOnline && (!isMyTurn || multiplayerRoom?.status !== 'playing')}
              onClick={() => handleAction({ type: 'PASS', desc: 'Pass turn' })}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                isOnline && (!isMyTurn || multiplayerRoom?.status !== 'playing')
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
              Tip: Hold Shift + Click Ready Operatives to assemble a strike team
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {bottomPlayer.affiliation && (
              <CardView
                card={bottomPlayer.affiliation}
                selected={selectedCard?.id === bottomPlayer.affiliation.id}
                onClick={() => setSelectedCard(selectedCard?.id === bottomPlayer.affiliation.id ? null : bottomPlayer.affiliation)}
              />
            )}
            {bottomPlayer.battlefield.map(card => {
              const isAttacker = selectedAttackers.some(a => a.id === card.id);
              const isDefender = pendingDefense?.selectedDefenderIds.includes(card.id) && pendingDefense.defender.pid === bottomPlayer.pid;
              const isTarget = selectedCombatTarget?.id === card.id;

              let role: 'attacker' | 'defender' | 'target' | undefined = undefined;
              let badge: string | undefined = undefined;
              if (isAttacker) {
                role = 'attacker';
                badge = 'Attacker';
              } else if (isDefender) {
                role = 'defender';
                badge = 'Defender';
              } else if (isTarget) {
                role = 'target';
                badge = 'Target';
              }

              return (
                <CardView
                  key={card.id}
                  card={card}
                  selected={isAttacker || isDefender || isTarget || selectedCard?.id === card.id}
                  selectionRole={role}
                  selectionBadge={badge}
                  onClick={(e) => {
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

                    // 2. If Shift is pressed or card is already an attacker in multi-select mode:
                    const isShift = e?.shiftKey;
                    if (isShift || isAttacker || selectedAttackers.length > 0) {
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
                        return;
                      }
                    }

                    // 3. Normal single card selection toggle
                    setSelectedCard(selectedCard?.id === card.id ? null : card);
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
              const effCost = bottomPlayer.affiliation?.specialAbility === 'play_operative' && card.type === 'Operative'
                ? Math.max(0, card.cost - 1)
                : card.cost;
              const isAffordable = effCost <= engine.getTotalSpendableCoins(bottomPlayer);

              const isPlayable = !mustDiscardExcess && (!isOnline || isMyTurn) && (
                isCardTypeMatch || (!hasPendingFree && isAffordable)
              );

              return (
                <CardView
                  key={card.id}
                  card={card}
                  isPlayable={isPlayable}
                  playLabel={isCardTypeMatch ? 'Deploy (FREE)' : `Deploy (${card.cost})`}
                  onPlay={() => {
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
                  selected={selectedCard?.id === card.id}
                  onClick={() => {
                    clearCombatSelection();
                    setSelectedCard(selectedCard?.id === card.id ? null : card);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* COMBAT PLANNER INTERFACE (MULTI-SELECT OPERATIVES) */}
      {selectedAttackers.length > 0 && (
        <CombatPlanner
          engine={engine}
          attackerPlayer={bottomPlayer}
          defenderPlayer={topPlayer}
          selectedAttackers={selectedAttackers}
          selectedTarget={selectedCombatTarget}
          selectedOperation={selectedCombatOp}
          onSelectOperation={(op) => setSelectedCombatOp(op)}
          onSelectTarget={(target) => setSelectedCombatTarget(target)}
          onClearAttackers={clearCombatSelection}
          onExecuteAttack={handleExecuteMultiAttack}
          disabled={isOnline && (!isMyTurn || multiplayerRoom?.status !== 'playing')}
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
            setPendingDefense({
              ...pendingDefense,
              selectedDefenderIds: nextIds
            });
          }}
          onConfirmDefense={handleConfirmDefense}
          onDeclineDefense={() => handleConfirmDefense([])}
          isOnlinePeerWaiting={isOnline && pendingDefense.defender.pid !== myPid}
          isSpecialAbilityAttack={pendingDefense.isSpecialAbilityAttack}
        />
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
        ) : isOnline && !isMyTurn ? (
          <div className="py-6 text-center text-xs font-mono text-zinc-400 flex flex-col items-center justify-center gap-2 bg-zinc-950/60 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-zinc-200 font-semibold">Opponent Turn in Progress</span>
            </div>
            <p className="text-zinc-500 text-[11px]">Awaiting {topPlayer.name}'s operational command...</p>
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
