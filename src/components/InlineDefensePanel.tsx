import React from 'react';
import { Action, Card, Player } from '../types/spywar';
import { Shield, AlertTriangle, Check, X, User, Bot, Loader2, Zap } from 'lucide-react';
import { SpywarEngine } from '../engine/SpywarEngine';
import { AbilityParserService } from '../services/abilityParserService';

interface InlineDefensePanelProps {
  engine: SpywarEngine;
  attacker: Player;
  defender: Player;
  threatType: 'ass' | 'sub' | 'raid';
  threatName: string;
  incomingAttack: number;
  attackerNames: string;
  targetCard?: Card | null;
  readyOps: Card[];
  selectedDefenderIds: string[];
  onToggleDefender: (cardId: string) => void;
  onConfirmDefense: (defenderIds: string[], bonusDef?: number) => void;
  onDeclineDefense: () => void;
  isOnlinePeerWaiting?: boolean;
  isSpecialAbilityAttack?: boolean;
  onActivateInterrupt?: (card: Card, action?: Action) => void;
}

export const InlineDefensePanel: React.FC<InlineDefensePanelProps> = ({
  engine,
  attacker,
  defender,
  threatType,
  threatName,
  incomingAttack,
  attackerNames,
  targetCard,
  readyOps,
  selectedDefenderIds,
  onToggleDefender,
  onConfirmDefense,
  onDeclineDefense,
  isOnlinePeerWaiting = false,
  isSpecialAbilityAttack = false,
  onActivateInterrupt
}) => {
  const [bonusDef, setBonusDef] = React.useState(0);
  const [playedReactions, setPlayedReactions] = React.useState<{ name: string; bonus: number }[]>([]);
  const [reactionFeedback, setReactionFeedback] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const spendableCoins = engine.getTotalSpendableCoins(defender);
  const allInterruptActions = engine.getInterruptActions(defender, attacker);

  // Discover all cards with Interrupt ability eligible for activation
  // Requirements:
  // 1. In-play cards (battlefield/affiliation) must be in Ready condition (not exhausted) unless Passive
  // 2. Player must have enough spendable resources to pay any activation cost
  // 3. Hand cards must have sufficient spendable coins to deploy/play
  const interruptCandidates: {
    card: Card;
    location: 'battlefield' | 'affiliation' | 'hand';
    cost: number;
    hasEnoughCoins: boolean;
    isReady: boolean;
    isPassive: boolean;
    parsedAbility: any;
    actions: Action[];
  }[] = [];

  // Check Affiliation for Interrupt
  if (defender.affiliation) {
    const aff = defender.affiliation;
    const parsed = aff.abilityText ? AbilityParserService.getInstance().parseAbility(aff.abilityText) : null;
    const isInterrupt = aff.isInterrupt || parsed?.isInterrupt || parsed?.trigger === 'interrupt' || aff.abilityText?.toLowerCase().includes('interrupt');
    if (isInterrupt) {
      const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
      const isReady = !aff.exhausted || isPassive;
      const cost = parsed?.costCoins || 0;
      const cardActions = allInterruptActions.filter(a => a.cardId === aff.id);
      interruptCandidates.push({
        card: aff,
        location: 'affiliation',
        cost,
        hasEnoughCoins: spendableCoins >= cost,
        isReady,
        isPassive,
        parsedAbility: parsed,
        actions: cardActions
      });
    }
  }

  // Check Battlefield for Interrupt
  for (const c of defender.battlefield) {
    const parsed = c.abilityText ? AbilityParserService.getInstance().parseAbility(c.abilityText) : null;
    const isInterrupt = c.isInterrupt || parsed?.isInterrupt || parsed?.trigger === 'interrupt' || c.abilityText?.toLowerCase().includes('interrupt');
    if (isInterrupt) {
      const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
      const isReady = !c.exhausted || isPassive;
      const cost = parsed?.costCoins || 0;
      const cardActions = allInterruptActions.filter(a => a.cardId === c.id);
      interruptCandidates.push({
        card: c,
        location: 'battlefield',
        cost,
        hasEnoughCoins: spendableCoins >= cost,
        isReady,
        isPassive,
        parsedAbility: parsed,
        actions: cardActions
      });
    }
  }

  // Check Hand for Interrupt
  for (const c of defender.hand) {
    const parsed = c.abilityText ? AbilityParserService.getInstance().parseAbility(c.abilityText) : null;
    const isInterrupt = c.isInterrupt || parsed?.isInterrupt || parsed?.trigger === 'interrupt' || c.abilityText?.toLowerCase().includes('interrupt');
    if (isInterrupt) {
      const cost = (c.cost || 0) + (parsed?.costCoins || 0);
      const cardActions = allInterruptActions.filter(a => a.cardId === c.id);
      interruptCandidates.push({
        card: c,
        location: 'hand',
        cost,
        hasEnoughCoins: spendableCoins >= cost,
        isReady: true,
        isPassive: parsed?.isPassive || false,
        parsedAbility: parsed,
        actions: cardActions
      });
    }
  }

  // Eligible out-of-turn defense cards in hand (Support, Intercept, Interrupt, or reactive abilities)
  const reactionCards = defender.hand.filter(c => {
    if (c.canPlayOnDefense || c.isIntercept || c.isInterrupt) return true;
    if (c.name.startsWith('Operative Crew') || c.specialAbility === 'operative_crew_intercept' || c.specialAbility === 'assemble_strike_defense') return true;
    if (c.abilityText) {
      const parsed = AbilityParserService.getInstance().parseAbility(c.abilityText);
      return parsed.canPlayOnDefense || parsed.isIntercept || parsed.isInterrupt || parsed.trigger === 'intercept' || parsed.trigger === 'interrupt';
    }
    return !isSpecialAbilityAttack && c.type === 'Support';
  });

  // Eligible in-play reaction cards (Affiliation or in-play cards with Intercept/Interrupt abilities)
  const reactionInPlayCards: Card[] = [];
  if (defender.affiliation) {
    const aff = defender.affiliation;
    const parsed = aff.abilityText ? AbilityParserService.getInstance().parseAbility(aff.abilityText) : null;
    const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
    if (!aff.exhausted || isPassive) {
      if (aff.canPlayOnDefense || aff.isIntercept || aff.isInterrupt || aff.specialAbility === 'the_company_intercept' || aff.name.includes('The Company') || parsed?.isIntercept || parsed?.isInterrupt || parsed?.canPlayOnDefense || parsed?.trigger === 'intercept' || parsed?.trigger === 'reaction_defense') {
        reactionInPlayCards.push(aff);
      }
    }
  }
  for (const c of defender.battlefield) {
    const parsed = c.abilityText ? AbilityParserService.getInstance().parseAbility(c.abilityText) : null;
    const isPassive = parsed?.isPassive || parsed?.trigger === 'passive';
    if (!c.exhausted || isPassive) {
      if (c.canPlayOnDefense || c.isIntercept || c.isInterrupt || parsed?.isIntercept || parsed?.isInterrupt || parsed?.canPlayOnDefense || parsed?.trigger === 'intercept' || parsed?.trigger === 'reaction_defense') {
        reactionInPlayCards.push(c);
      }
    }
  }

  const handlePlayReaction = (card: Card, subChoice?: 'assemble_defense' | 'assemble_strike' | 'buff_defense_team' | 'buff_attack_team') => {
    setReactionFeedback(null);
    const res = engine.playDefensiveReactionCard(defender, card.id, subChoice, selectedDefenderIds);
    if (res.success) {
      if (res.defBonus > 0) {
        setBonusDef(prev => prev + res.defBonus);
      }
      setPlayedReactions(prev => [...prev, { name: card.name, bonus: res.defBonus }]);
      setReactionFeedback({ text: res.message });
      if (res.createdDefenderId) {
        onToggleDefender(res.createdDefenderId);
      }
    } else {
      setReactionFeedback({ text: res.message, isError: true });
    }
  };

  // Dynamically include any newly spawned ready operatives on the battlefield (such as The Company's 2/2 token)
  const currentBattlefieldReadyOps = defender.battlefield.filter(c => c.type === 'Operative' && !c.exhausted);
  const combinedReadyOps = [...readyOps];
  for (const op of currentBattlefieldReadyOps) {
    if (!combinedReadyOps.some(o => o.id === op.id)) {
      combinedReadyOps.push(op);
    }
  }

  // Rule: An attack using a card's special abilities can ONLY be defended by using a card with an Interrupt or Intercept special ability.
  // It cannot normally be defended using a Defense Team Operative cards.
  const eligibleReadyOps = combinedReadyOps.filter(c => {
    if (!isSpecialAbilityAttack) return true;
    const parsed = (c.abilityText || c.specialAbility) ? AbilityParserService.getInstance().parseAbility(c.abilityText || c.specialAbility) : null;
    return c.isIntercept || c.isInterrupt || c.discardAfterDefending || parsed?.isIntercept || parsed?.isInterrupt;
  });

  // If target is specified and defending against assassination, calculate target's innate defense
  const isAss = threatType === 'ass';
  const targetAlreadyInDefenders = targetCard ? selectedDefenderIds.includes(targetCard.id) : false;
  const targetCanDefendSpecial = !isSpecialAbilityAttack || (targetCard && (
    targetCard.isIntercept || targetCard.isInterrupt ||
    (targetCard.abilityText && AbilityParserService.getInstance().parseAbility(targetCard.abilityText).isIntercept)
  ));
  const targetCalc = (isAss && targetCard && !targetAlreadyInDefenders && targetCanDefendSpecial)
    ? engine.calculateOperativeDefense(targetCard, 'ass')
    : null;
  const targetInnateDef = targetCalc ? targetCalc.totalDef : 0;

  // Defenders defense contribution
  const selectedOps = eligibleReadyOps.filter(c => selectedDefenderIds.includes(c.id));
  const defendersTotalDef = selectedOps.reduce((acc, c) => acc + engine.calculateOperativeDefense(c, threatType).totalDef, 0);

  // Total defense against the strike
  const totalCombinedDefense = defendersTotalDef + targetInnateDef + bonusDef;
  const isThwarted = totalCombinedDefense >= incomingAttack;

  const allPossibleDef = eligibleReadyOps.reduce((acc, c) => acc + engine.calculateOperativeDefense(c, threatType).totalDef, 0) + targetInnateDef + bonusDef;

  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-red-950/70 via-zinc-900 to-zinc-950 border-2 border-red-500/80 shadow-2xl space-y-3.5 animate-in fade-in slide-in-from-top-3 duration-200">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                Defensive Intercept: {defender.name} Active Defense
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950 text-red-300 border border-red-800 uppercase">
                Combat Intercept
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              <strong className="text-zinc-200">{attacker.name}</strong> is attacking with <strong className="text-red-400">{attackerNames}</strong>!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40">
            Incoming Attack: {incomingAttack} ATK
          </span>
        </div>
      </div>

      {/* Special Ability Attack Warning Banner */}
      {isSpecialAbilityAttack && (
        <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/50 text-xs font-mono text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Special Ability Attack:</strong> Can only be defended using a card with an <strong>Interrupt</strong> or <strong>Intercept</strong> ability. Regular Defense Team Operatives cannot normally defend.
          </span>
        </div>
      )}

      {/* Target & Threat Info */}
      <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="space-y-0.5">
          <div className="text-zinc-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>Operation: <strong>{threatName}</strong></span>
          </div>
          {targetCard && (
            <div className="text-zinc-400">
              Assassination Target: <strong className="text-zinc-100">{targetCard.name}</strong> (Innate DEF: {targetInnateDef})
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-zinc-400">Defense Formula:</div>
          <div className="text-[11px] text-zinc-300">
            Base DEF + Buffs + 1 per {threatType.toUpperCase()} skill
          </div>
        </div>
      </div>

      {/* ⚡ INTERRUPT SPECIAL ABILITIES (SEIZE INITIATIVE & STOP OPPONENT TURN) */}
      {!isOnlinePeerWaiting && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/70 via-yellow-950/50 to-zinc-900 border-2 border-yellow-500/70 shadow-xl space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                <Zap className="w-4 h-4 fill-current animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                  <span>⚡ INTERRUPT SPECIAL ABILITIES: SEIZE INITIATIVE</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-300 font-mono border border-yellow-500/40">
                    Off-Turn Counter-Action
                  </span>
                </h4>
                <p className="text-[10px] text-zinc-300 font-mono">
                  Activating an Interrupt immediately <strong>STOPS {attacker.name}'s turn</strong> so you can play your ability and <strong>launch a Counter-Attack Operation</strong>!
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded border border-zinc-800">
              Spendable: <strong className="text-amber-300">{spendableCoins} Coins</strong>
            </span>
          </div>

          {interruptCandidates.length === 0 ? (
            <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <span className="text-zinc-500">ℹ️</span>
              <span>No cards with Interrupt special ability available in hand or ready in play.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {interruptCandidates.map(cand => {
                const canActivate = cand.isReady && cand.hasEnoughCoins;
                return (
                  <div
                    key={`${cand.location}_${cand.card.id}`}
                    className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs font-mono transition-all ${
                      canActivate
                        ? 'bg-zinc-900/90 border-yellow-500/60 shadow-md'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 opacity-60'
                    }`}
                  >
                    <div className="space-y-0.5 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-100">{cand.card.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 uppercase">
                          {cand.location === 'affiliation' ? 'Affiliation' : cand.location === 'battlefield' ? (cand.isPassive ? 'In Play (Passive)' : 'In Play (Ready)') : 'In Hand'}
                        </span>
                        {!cand.isReady && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-800">
                            Exhausted (Not Ready)
                          </span>
                        )}
                        {cand.isPassive && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Passive
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-300">
                        {cand.card.abilityText || 'Interrupt Special Ability'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {cand.cost > 0 ? `Cost: ${cand.cost} Coins` : 'Cost: Free'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!cand.isReady ? (
                        <span className="text-[11px] text-red-400 font-bold">Must be in Ready condition</span>
                      ) : !cand.hasEnoughCoins ? (
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1 rounded bg-zinc-800 text-amber-400 text-xs font-bold border border-amber-900/50 cursor-not-allowed"
                        >
                          Need {cand.cost} Coins
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (onActivateInterrupt) {
                              const actionToRun = cand.actions[0];
                              onActivateInterrupt(cand.card, actionToRun);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 active:scale-95 text-black font-extrabold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Seize Initiative &amp; Stop Attack</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reaction Cards in Hand (Support / Intercept Cards playable out of turn) */}
      {reactionCards.length > 0 && !isOnlinePeerWaiting && (
        <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-indigo-300">
            <span className="font-semibold flex items-center gap-1.5">
              <span>⚡ Out-of-Turn Reaction Cards in Hand</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-900/80 text-indigo-200">Defending</span>
            </span>
            {playedReactions.length > 0 && (
              <span className="text-emerald-400 font-bold">
                +{bonusDef} DEF from [{playedReactions.map(r => r.name).join(', ')}]
              </span>
            )}
          </div>
          {reactionFeedback && (
            <div className={`p-2 rounded text-[11px] font-mono flex items-center gap-1.5 ${reactionFeedback.isError ? 'bg-rose-950/70 border border-rose-500/50 text-rose-300' : 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'}`}>
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span>{reactionFeedback.text}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {reactionCards.map(c => {
              const isOperativeCrew = c.name.startsWith('Operative Crew') || c.specialAbility === 'operative_crew_intercept';
              const isAssemble = c.specialAbility === 'assemble_strike_defense';
              const cost = c.cost || 0;
              const spendable = engine.getTotalSpendableCoins(defender);
              const hasCoins = spendable >= cost;
              const hasDefenseTeam = selectedDefenderIds.length > 0;

              if (isOperativeCrew) {
                return (
                  <div key={c.id} className="flex items-center gap-2 bg-zinc-900 border border-emerald-500/50 rounded-lg p-2 shadow-sm">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-100 font-bold text-xs">{c.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">Intercept</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Cost: {cost} Coins (Have {spendable})
                      </div>
                    </div>
                    {!hasDefenseTeam ? (
                      <button
                        type="button"
                        disabled
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-500 text-[11px] font-bold border border-zinc-700/50 cursor-not-allowed"
                        title="Select at least 1 ready Operative on the battlefield to form a Defense Team first"
                      >
                        Select Defense Team First
                      </button>
                    ) : !hasCoins ? (
                      <button
                        type="button"
                        disabled
                        className="px-2.5 py-1 rounded bg-zinc-800 text-amber-400 text-[11px] font-bold border border-amber-900/50 cursor-not-allowed"
                        title={`Requires ${cost} Spendable Coins`}
                      >
                        Need {cost} Coins
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePlayReaction(c, 'buff_defense_team')}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold shadow-md transition-all flex items-center gap-1"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Intercept (+2 DEF to Defense Team)</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div key={c.id} className="flex items-center gap-1.5 bg-zinc-900 border border-indigo-500/40 rounded-lg p-1.5">
                  <span className="text-zinc-200 font-bold text-xs">{c.name}</span>
                  {isAssemble ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handlePlayReaction(c, 'assemble_defense')}
                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold"
                      >
                        +2 DEF Team
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePlayReaction(c, 'assemble_strike')}
                        className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold"
                      >
                        +1 DEF / Strike
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlayReaction(c)}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold"
                    >
                      Play (+{c.def || 2} DEF)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In-Play Reactions & Affiliation Intercept */}
      {reactionInPlayCards.length > 0 && !isOnlinePeerWaiting && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="font-semibold flex items-center gap-1.5">
              <span>🛡️ In-Play &amp; Affiliation Intercept Reactions</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-200">In Play</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {reactionInPlayCards.map(c => {
              const parsed = AbilityParserService.getInstance().parseAbility(c.abilityText || c.specialAbility);
              const cost = parsed.costCoins || 0;
              const spendable = engine.getTotalSpendableCoins(defender);
              const hasCoins = spendable >= cost;
              const isTokenSpawner = parsed.effects.some(e => e.type === 'spawn_token') || /token/i.test(c.abilityText || '');
              const spawnEff = parsed.effects.find(e => e.type === 'spawn_token');
              const tokenStats = `${spawnEff?.tokenOff || 2}/${spawnEff?.tokenDef || 2}`;

              return (
                <div key={c.id} className="flex items-center gap-2 bg-zinc-900 border border-emerald-500/50 rounded-lg p-2 shadow-sm">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-100 font-bold text-xs">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                        {c.type === 'Affiliation' ? 'Affiliation Intercept' : 'Intercept'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {isTokenSpawner 
                        ? `Creates ${tokenStats} Operative token to intercept (Discards after defending)`
                        : `Defensive Reaction (+${parsed.effects.find(e => e.type === 'intercept_defense')?.amount || 2} DEF)`}
                      {cost > 0 && ` • Cost: ${cost} Coins`}
                    </div>
                  </div>
                  {!hasCoins ? (
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded bg-zinc-800 text-amber-400 text-[11px] font-bold border border-amber-900/50 cursor-not-allowed"
                    >
                      Need {cost} Coins
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlayReaction(c)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold shadow-md transition-all flex items-center gap-1"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{isTokenSpawner ? `Intercept (Create ${tokenStats} Operative)` : 'Activate Intercept'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ready Operatives Defensive Selection List */}
      {eligibleReadyOps.length > 0 && (
        <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Assigned Operative Defenders ({selectedOps.length}/{eligibleReadyOps.length})</span>
            </span>
            <span className="text-[10px] text-zinc-400">
              Click to assign or unassign as blocker
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {eligibleReadyOps.map(op => {
              const isSelected = selectedDefenderIds.includes(op.id);
              const calc = engine.calculateOperativeDefense(op, threatType);
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => onToggleDefender(op.id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400 text-blue-200 shadow-sm'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-zinc-600'}`}>
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span>{op.name}</span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-blue-500/30 text-blue-300' : 'bg-zinc-700 text-zinc-300'}`}>
                    {calc.totalDef} DEF
                  </span>
                  {op.discardAfterDefending && (
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Discards After Defending
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Defense Assessment Status Bar */}
      <div className="p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 bg-zinc-950/70 border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Combined Defense Power:</span>
          <span className={`font-bold text-sm ${totalCombinedDefense > incomingAttack ? 'text-emerald-400' : totalCombinedDefense === incomingAttack ? 'text-amber-400' : 'text-rose-400'}`}>
            {totalCombinedDefense} DEF
          </span>
          {bonusDef > 0 && (
            <span className="text-indigo-400 text-xs">(includes +{bonusDef} reaction)</span>
          )}
          <span className="text-zinc-500 text-xs">vs {incomingAttack} ATK</span>
        </div>

        <div>
          {isAss ? (
            totalCombinedDefense > incomingAttack ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Assassination Repelled (Attackers Discarded)
              </span>
            ) : totalCombinedDefense === incomingAttack ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Mutual Casualties (Both Sides Discarded)
              </span>
            ) : (
              <span className="text-rose-400 font-semibold">
                Assassination Succeeds (Defending Cards Discarded)
              </span>
            )
          ) : (
            totalCombinedDefense > incomingAttack ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Thwarted! (Attackers Discarded)
              </span>
            ) : totalCombinedDefense === incomingAttack ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Thwarted (Tied - All Operatives Discarded)
              </span>
            ) : (
              <span className="text-rose-400 font-semibold">
                Breached! (Defenders Discarded)
              </span>
            )
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800">
        {isOnlinePeerWaiting ? (
          <div className="w-full text-center py-2 px-4 text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>{defender.name} is choosing defensive interceptors on the battlefield...</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onDeclineDefense}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors"
              title="Decline sending any ready operatives to defend (0 DEF from operatives)"
            >
              Decline Defense (0 DEF)
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onConfirmDefense(eligibleReadyOps.map(c => c.id), bonusDef)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-mono font-bold transition-colors border border-amber-500/30"
                title="Shortcut to commit all available eligible Operative cards to defend"
              >
                Defend with All ({allPossibleDef} DEF)
              </button>

              <button
                type="button"
                onClick={() => onConfirmDefense(selectedDefenderIds, bonusDef)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-mono font-bold shadow-md transition-colors flex items-center gap-1.5"
              >
                <Shield className="w-4 h-4" />
                Confirm Defense ({totalCombinedDefense} DEF)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
