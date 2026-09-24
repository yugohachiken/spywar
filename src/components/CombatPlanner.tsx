import React from 'react';
import { Card, Player } from '../types/spywar';
import { Sword, Shield, Skull, Terminal, Eye, AlertTriangle, Check, X, Crosshair } from 'lucide-react';
import { SpywarEngine } from '../engine/SpywarEngine';

export type CombatOperationType = 'ass' | 'raid' | 'sub';

interface CombatPlannerProps {
  engine: SpywarEngine;
  attackerPlayer: Player;
  defenderPlayer: Player;
  selectedAttackers: Card[];
  selectedTarget: Card | null;
  selectedOperation: CombatOperationType | null;
  onSelectOperation: (op: CombatOperationType) => void;
  onSelectTarget: (target: Card | null) => void;
  onClearAttackers: () => void;
  onExecuteAttack: () => void;
  disabled?: boolean;
}

export const CombatPlanner: React.FC<CombatPlannerProps> = ({
  engine,
  attackerPlayer,
  defenderPlayer,
  selectedAttackers,
  selectedTarget,
  selectedOperation,
  onSelectOperation,
  onSelectTarget,
  onClearAttackers,
  onExecuteAttack,
  disabled = false
}) => {
  if (selectedAttackers.length === 0) return null;

  const getCardTokenBuff = (c: Card) =>
    (c.techTokens || 0) + (c.weaponTokens || 0) + (c.suitTokens || 0) + (c.poweredArmorTokens || 0) + (c.powerSuitTokens || 0);

  // Calculate Base Offense and Skills for the operative team (including Tech, Weapon, Suit, Armor tokens & buffs)
  const baseOffense = selectedAttackers.reduce((acc, c) => acc + (c.off || 1) + (c.tempOffenseBuff || 0) + getCardTokenBuff(c), 0);
  const totalAssSkill = selectedAttackers.reduce((acc, c) => acc + (c.ass || 0), 0);
  const totalRaidSkill = selectedAttackers.reduce((acc, c) => acc + (c.raid || 0), 0);
  const totalSubSkill = selectedAttackers.reduce((acc, c) => acc + (c.sub || 0), 0);

  // Targets
  const enemyOps = defenderPlayer.battlefield.filter(c => c.type === 'Operative');
  const enemyLocs = defenderPlayer.battlefield.filter(c => c.type === 'Location');
  const enemyAffiliation = defenderPlayer.affiliation;

  // Potential targets for raid: Locations and Affiliation cards that have stored coins
  const raidTargets: { label: string; card: Card; storedCoins: number }[] = [];
  if (enemyAffiliation && typeof enemyAffiliation.stored_coins === 'number' && enemyAffiliation.stored_coins > 0) {
    raidTargets.push({
      label: `${enemyAffiliation.name} (Affiliation)`,
      card: enemyAffiliation,
      storedCoins: enemyAffiliation.stored_coins
    });
  }
  enemyLocs.forEach(loc => {
    if ((loc.stored_coins || 0) > 0) {
      raidTargets.push({
        label: `${loc.name} (Location)`,
        card: loc,
        storedCoins: loc.stored_coins || 0
      });
    }
  });

  // Current calculated attack value depending on chosen operation
  let currentSkillBonus = 0;
  let opSkillLabel = '';
  if (selectedOperation === 'ass') {
    currentSkillBonus = totalAssSkill;
    opSkillLabel = 'Assassination';
  } else if (selectedOperation === 'raid') {
    currentSkillBonus = totalRaidSkill;
    opSkillLabel = 'Raid';
  } else if (selectedOperation === 'sub') {
    currentSkillBonus = totalSubSkill;
    opSkillLabel = 'Subterfuge';
  }
  const totalAttackPower = baseOffense + currentSkillBonus;

  // Check target defense for assassination
  let targetDefenseInfo: { baseDef: number; skillBonus: number; totalDef: number } | null = null;
  if (selectedOperation === 'ass' && selectedTarget) {
    const baseDef = selectedTarget.def || 1;
    const tempBuff = (selectedTarget.tempDefenseBuff || 0) + getCardTokenBuff(selectedTarget);
    const isExh = selectedTarget.exhausted;
    // Rule: Innate defense includes assassination skill if Ready
    const skillBonus = isExh ? 0 : (selectedTarget.ass || 0);
    targetDefenseInfo = {
      baseDef: baseDef + tempBuff,
      skillBonus,
      totalDef: baseDef + tempBuff + skillBonus
    };
  }

  const isExecutable = (() => {
    if (disabled) return false;
    if (!selectedOperation) return false;
    if (selectedOperation === 'ass' && !selectedTarget) return false;
    if (selectedOperation === 'raid' && !selectedTarget) return false;
    if (selectedOperation === 'sub' && defenderPlayer.hand.length === 0) return false;
    return true;
  })();

  return (
    <div className="p-3.5 rounded-xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/30 border-2 border-amber-500/70 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Sword className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
                Strike Team Prepared ({selectedAttackers.length} Operative{selectedAttackers.length > 1 ? 's' : ''})
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Shift + Click to add/remove
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              Team: {selectedAttackers.map(a => a.name).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearAttackers}
            className="px-2.5 py-1 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Step 1: Operation Selection */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
          <span>1. Select Operation:</span>
          {selectedOperation && (
            <span className="text-amber-400 font-bold">
              Total ATK: {totalAttackPower} (Offense: {baseOffense} {currentSkillBonus > 0 ? `+ Skill: ${currentSkillBonus}` : ''})
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Assassination Option */}
          <button
            type="button"
            disabled={enemyOps.length === 0}
            onClick={() => {
              onSelectOperation('ass');
              if (!selectedTarget && enemyOps.length > 0) {
                onSelectTarget(enemyOps[0]);
              }
            }}
            className={`p-2.5 rounded-lg border text-left transition-all relative ${
              selectedOperation === 'ass'
                ? 'bg-rose-950/40 border-rose-500 text-zinc-100 shadow-md ring-1 ring-rose-500/50'
                : enemyOps.length === 0
                ? 'bg-zinc-950/40 border-zinc-800/60 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Skull className="w-3.5 h-3.5 text-rose-400" />
                <span>Assassination</span>
              </div>
              <span className="font-mono text-xs font-bold text-rose-400">
                {baseOffense + totalAssSkill} ATK
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mt-1">
              Base Off: {baseOffense} | Ass Skill: +{totalAssSkill}
            </div>
            {enemyOps.length === 0 && (
              <div className="text-[10px] text-zinc-500 italic mt-0.5">No enemy operatives in play</div>
            )}
          </button>

          {/* Raid Option */}
          <button
            type="button"
            disabled={raidTargets.length === 0}
            onClick={() => {
              onSelectOperation('raid');
              // default target is the first raid target with stored coins
              onSelectTarget(raidTargets[0]?.card || null);
            }}
            className={`p-2.5 rounded-lg border text-left transition-all relative ${
              selectedOperation === 'raid'
                ? 'bg-amber-950/40 border-amber-500 text-zinc-100 shadow-md ring-1 ring-amber-500/50'
                : raidTargets.length === 0
                ? 'bg-zinc-950/40 border-zinc-800/60 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Raid Coins</span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-400">
                {baseOffense + totalRaidSkill} ATK
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mt-1 flex items-center justify-between">
              <span>Base Off: {baseOffense} | Raid: +{totalRaidSkill}</span>
              <span className="text-amber-400 font-bold">Yield: +{selectedAttackers.length + totalRaidSkill} coin{selectedAttackers.length + totalRaidSkill !== 1 ? 's' : ''}</span>
            </div>
            {raidTargets.length === 0 && (
              <div className="text-[10px] text-zinc-500 italic mt-0.5">No Affiliation/Location has coins to raid</div>
            )}
          </button>

          {/* Subterfuge Option */}
          <button
            type="button"
            disabled={defenderPlayer.hand.length === 0}
            onClick={() => {
              onSelectOperation('sub');
              onSelectTarget(null);
            }}
            className={`p-2.5 rounded-lg border text-left transition-all relative ${
              selectedOperation === 'sub'
                ? 'bg-purple-950/40 border-purple-500 text-zinc-100 shadow-md ring-1 ring-purple-500/50'
                : defenderPlayer.hand.length === 0
                ? 'bg-zinc-950/40 border-zinc-800/60 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span>Subterfuge</span>
              </div>
              <span className="font-mono text-xs font-bold text-purple-400">
                {baseOffense + totalSubSkill} ATK
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono mt-1 flex items-center justify-between">
              <span>Base Off: {baseOffense} | Sub: +{totalSubSkill}</span>
              <span className="text-purple-400 font-bold">Yield: +{selectedAttackers.length + totalSubSkill} card{selectedAttackers.length + totalSubSkill !== 1 ? 's' : ''}</span>
            </div>
            {defenderPlayer.hand.length === 0 && (
              <div className="text-[10px] text-zinc-500 italic mt-0.5">Enemy hand is empty</div>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: Target Selection (Context-sensitive) */}
      {selectedOperation === 'ass' && (
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>2. Select Assassination Target:</span>
            {selectedTarget && targetDefenseInfo && (
              <span className="text-zinc-300 font-mono">
                Target Innate Defense: <strong className="text-blue-400">{targetDefenseInfo.totalDef} DEF</strong> (Base: {targetDefenseInfo.baseDef} {targetDefenseInfo.skillBonus > 0 ? `+ Skill: ${targetDefenseInfo.skillBonus}` : ''})
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {enemyOps.map(op => {
              const isSelected = selectedTarget?.id === op.id;
              const isExh = op.exhausted;
              const opDef = (op.def || 1) + getCardTokenBuff(op) + (op.tempDefenseBuff || 0) + (isExh ? 0 : (op.ass || 0));

              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => onSelectTarget(op)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200 ring-1 ring-rose-500 shadow-sm'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isSelected ? 'text-rose-400' : 'text-zinc-500'}`} />
                  <span className="font-semibold">{op.name}</span>
                  <span className="text-[11px] text-blue-400">DEF: {opDef}</span>
                  {isExh ? <span className="text-zinc-500 text-[10px]">(E)</span> : <span className="text-emerald-400 text-[10px]">(R)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedOperation === 'raid' && (
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
            2. Select Raid Target:
          </div>

          <div className="flex flex-wrap gap-2">
            {raidTargets.map((rt, idx) => {
              const isSelected = selectedTarget?.id === rt.card.id;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectTarget(rt.card)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200 ring-1 ring-amber-500 shadow-sm'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <Terminal className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span className="font-semibold">{rt.label}</span>
                  <span className="text-amber-400">({rt.storedCoins} Coins)</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-zinc-300 font-mono bg-zinc-950/70 px-2.5 py-1.5 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Success Yield:</span>
            <span className="text-amber-400 font-semibold">
              {selectedAttackers.length} card{selectedAttackers.length > 1 ? 's' : ''} + {totalRaidSkill} Raid Skill = up to {selectedAttackers.length + totalRaidSkill} coin{selectedAttackers.length + totalRaidSkill !== 1 ? 's' : ''} taken
            </span>
          </div>
        </div>
      )}

      {selectedOperation === 'sub' && (
        <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
          <p className="text-[11px] text-zinc-400 font-mono">
            Subterfuge targets <strong className="text-zinc-200">{defenderPlayer.name}'s Hand</strong> ({defenderPlayer.hand.length} card{defenderPlayer.hand.length !== 1 ? 's' : ''}).
          </p>
          <div className="text-[11px] text-zinc-300 font-mono bg-zinc-950/70 px-2.5 py-1.5 rounded border border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Success Yield:</span>
            <span className="text-purple-400 font-semibold">
              {selectedAttackers.length} card{selectedAttackers.length > 1 ? 's' : ''} + {totalSubSkill} Sub Skill = up to {selectedAttackers.length + totalSubSkill} card{selectedAttackers.length + totalSubSkill !== 1 ? 's' : ''} discarded
            </span>
          </div>
        </div>
      )}

      {/* Action Execution Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-400">Offense:</span>
          <span className="font-bold text-amber-400">{baseOffense} Base</span>
          {currentSkillBonus > 0 && (
            <span className="text-cyan-300">+{currentSkillBonus} {opSkillLabel} Skill</span>
          )}
          <span className="text-zinc-500">=</span>
          <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            {totalAttackPower} Total ATK
          </span>
        </div>

        <button
          type="button"
          disabled={!isExecutable}
          onClick={onExecuteAttack}
          className={`px-4 py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
            isExecutable
              ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer shadow-amber-500/20'
              : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          <span>Launch {selectedOperation ? selectedOperation.toUpperCase() : 'Operation'}</span>
        </button>
      </div>
    </div>
  );
};
