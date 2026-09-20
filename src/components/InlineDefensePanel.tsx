import React from 'react';
import { Card, Player } from '../types/spywar';
import { Shield, AlertTriangle, Check, X, User, Bot, Loader2 } from 'lucide-react';
import { SpywarEngine } from '../engine/SpywarEngine';

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
  onConfirmDefense: (defenderIds: string[]) => void;
  onDeclineDefense: () => void;
  isOnlinePeerWaiting?: boolean;
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
  isOnlinePeerWaiting = false
}) => {
  // If target is specified and defending against assassination, calculate target's innate defense
  const isAss = threatType === 'ass';
  const targetAlreadyInDefenders = targetCard ? selectedDefenderIds.includes(targetCard.id) : false;
  const isTargetExh = targetCard?.exhausted ?? false;
  const targetInnateDef = (isAss && targetCard && !targetAlreadyInDefenders)
    ? ((targetCard.def || 1) + (targetCard.tempDefenseBuff || 0) + (isTargetExh ? 0 : (targetCard.ass || 0)))
    : 0;

  // Defenders defense contribution
  const selectedOps = readyOps.filter(c => selectedDefenderIds.includes(c.id));
  const defendersTotalDef = selectedOps.reduce((acc, c) => acc + engine.calculateOperativeDefense(c, threatType).totalDef, 0);

  // Total defense against the strike
  const totalCombinedDefense = defendersTotalDef + targetInnateDef;
  const isThwarted = totalCombinedDefense >= incomingAttack;

  const allPossibleDef = readyOps.reduce((acc, c) => acc + engine.calculateOperativeDefense(c, threatType).totalDef, 0) + targetInnateDef;

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

      {/* Defense Assessment Status Bar */}
      <div className="p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 bg-zinc-950/70 border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Combined Defense Power:</span>
          <span className={`font-bold text-sm ${totalCombinedDefense > incomingAttack ? 'text-emerald-400' : totalCombinedDefense === incomingAttack ? 'text-amber-400' : 'text-rose-400'}`}>
            {totalCombinedDefense} DEF
          </span>
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
                onClick={() => onConfirmDefense(readyOps.map(c => c.id))}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-mono font-bold transition-colors border border-amber-500/30"
                title="Shortcut to commit all available Ready Operative cards to defend"
              >
                Defend with All ({allPossibleDef} DEF)
              </button>

              <button
                type="button"
                onClick={() => onConfirmDefense(selectedDefenderIds)}
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
