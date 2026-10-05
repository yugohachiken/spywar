import React from 'react';
import { Card } from '../types/spywar';
import { Shield, Sword, Coins, Skull, Terminal, Eye, Sparkles, ZoomIn } from 'lucide-react';
import { useCardZoom } from '../context/CardZoomContext';

interface CardViewProps {
  card: Card;
  isPlayable?: boolean;
  onPlay?: () => void;
  isDiscardable?: boolean;
  onDiscard?: () => void;
  onClick?: (e?: React.MouseEvent) => void;
  selected?: boolean;
  selectionRole?: 'attacker' | 'defender' | 'target' | 'benefit' | 'buff_target';
  selectionBadge?: string;
  compact?: boolean;
  playLabel?: string;
  isFaceDown?: boolean;
  isFlipping?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isPlayable = false,
  onPlay,
  isDiscardable = false,
  onDiscard,
  onClick,
  selected = false,
  selectionRole,
  selectionBadge,
  compact = false,
  playLabel,
  isFaceDown = false,
  isFlipping = false
}) => {
  const { setHighlightedItem, clearHighlightedItem, openZoom, highlightedItem } = useCardZoom();
  const isExhausted = card.exhausted;
  const isCurrentlyHighlighted = highlightedItem?.id === card.id;

  // Face Down Classified Card Back
  if (isFaceDown) {
    return (
      <div
        tabIndex={0}
        role="img"
        aria-label="Classified Card (Face Down). Click Start to flip face up."
        onClick={onClick}
        className={`relative select-none transition-all duration-500 rounded-lg p-2.5 flex flex-col justify-between bg-gradient-to-br from-zinc-950 via-slate-950 to-zinc-900 border-2 border-amber-500/40 shadow-xl overflow-hidden ${
          compact ? 'w-36 h-48 text-xs' : 'w-44 h-56 text-xs'
        } ${isFlipping ? 'scale-95 rotate-y-90 opacity-80' : 'hover:border-amber-400/80 hover:shadow-amber-500/10'}`}
      >
        {/* Subtle microdot tactical pattern background */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />
        
        {/* Outer security perimeter border */}
        <div className="absolute inset-1.5 border border-dashed border-amber-500/30 rounded pointer-events-none" />

        {/* Top Classification Banner */}
        <div className="w-full flex items-center justify-between text-[9px] font-mono text-amber-400/90 z-10 px-1 pt-0.5 border-b border-zinc-800/80 pb-1">
          <span className="flex items-center gap-1 font-bold tracking-wider">
            <Shield className="w-3 h-3 text-amber-400" />
            TOP SECRET
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[8px] tracking-widest text-amber-300 font-bold">
            CLASSIFIED
          </span>
        </div>

        {/* Center Insignia / Spy Seal */}
        <div className="my-auto flex flex-col items-center justify-center gap-1.5 z-10">
          <div className="w-12 h-12 rounded-full bg-zinc-900/90 border-2 border-amber-500/60 flex items-center justify-center shadow-lg shadow-amber-950/60 relative group-hover:scale-105 transition-transform">
            <Eye className="w-6 h-6 text-amber-400 animate-pulse" />
            <div className="absolute -inset-1 rounded-full border border-amber-400/30 animate-spin [animation-duration:12s]" />
          </div>
          <div className="space-y-0.5 text-center">
            <span className="block font-black font-mono tracking-widest text-sm text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200">
              SPYWAR
            </span>
            <span className="block font-mono text-[9px] text-zinc-400 tracking-wider uppercase">
              {card.type === 'Affiliation' ? 'Affiliation Seal' : 'Classified Asset'}
            </span>
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="w-full pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[8px] font-mono text-zinc-400 z-10 px-1">
          <span className="text-zinc-500">LEVEL-5</span>
          <span className="text-amber-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
            FACE DOWN
          </span>
        </div>
      </div>
    );
  }

  const getTypeBadgeColor = () => {
    switch (card.type) {
      case 'Affiliation': return 'bg-amber-900/60 text-amber-300 border-amber-500/50';
      case 'Location': return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50';
      case 'Operative': return card.isNamed ? 'bg-rose-950/60 text-rose-300 border-rose-500/50' : 'bg-red-950/60 text-red-300 border-red-500/50';
      case 'Support': return 'bg-purple-950/60 text-purple-300 border-purple-500/50';
      case 'Mission': return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50';
      default: return 'bg-slate-800 text-slate-300 border-slate-600';
    }
  };

  const getBorderColor = () => {
    if (selected) {
      if (selectionRole === 'attacker') {
        return 'ring-2 ring-amber-400 border-amber-400 shadow-amber-500/40 shadow-xl animate-pulse';
      }
      if (selectionRole === 'defender') {
        return 'ring-2 ring-blue-400 border-blue-400 shadow-blue-500/40 shadow-xl animate-pulse';
      }
      if (selectionRole === 'target') {
        return 'ring-2 ring-rose-500 border-rose-500 shadow-rose-500/40 shadow-xl animate-pulse';
      }
      if (selectionRole === 'benefit' || selectionRole === 'buff_target') {
        return 'ring-2 ring-emerald-400 border-emerald-400 shadow-emerald-500/40 shadow-lg animate-pulse';
      }
      return 'ring-2 ring-amber-400 border-amber-400 shadow-amber-500/20 shadow-lg';
    }
    if (selectionRole === 'benefit' || selectionRole === 'buff_target') {
      return 'ring-2 ring-emerald-500/80 border-emerald-400 shadow-emerald-500/30 shadow-md animate-pulse cursor-pointer hover:ring-emerald-300';
    }
    if (isCurrentlyHighlighted) return 'ring-1 ring-amber-500/60 border-amber-500/80 shadow-amber-500/10 shadow-md';
    if (isPlayable) return 'border-emerald-500/80 hover:border-emerald-400 cursor-pointer shadow-emerald-500/10 shadow-md';
    if (card.isNamed) return 'border-amber-500/60';
    return 'border-zinc-800 hover:border-zinc-700';
  };

  const handleZoomClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openZoom(card);
  };

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`${card.name}, ${card.type}. Press Spacebar to magnify.`}
      onMouseEnter={() => setHighlightedItem(card)}
      onMouseLeave={() => clearHighlightedItem(card)}
      onFocus={() => setHighlightedItem(card)}
      onClick={onClick || (isPlayable ? onPlay : undefined)}
      className={`relative group select-none transition-all duration-300 rounded-lg p-2.5 flex flex-col justify-between bg-zinc-900/90 backdrop-blur-sm border outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${getBorderColor()} ${
        isExhausted && !selected && !selectionRole ? 'opacity-60 saturate-50 translate-y-0.5' : isExhausted ? 'translate-y-0.5' : ''
      } ${compact ? 'w-36 h-48 text-xs' : 'w-44 h-56 text-xs'} ${isFlipping ? 'animate-in fade-in zoom-in-90 duration-500' : ''}`}
    >
      {/* Selection Role / Multi-Select Badge */}
      {selectionBadge && (
        <div className={`absolute -top-2.5 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shadow-md ${
          selectionRole === 'attacker'
            ? 'bg-amber-500 text-zinc-950 border border-amber-300 ring-1 ring-amber-400/50 shadow-amber-950/40'
            : selectionRole === 'defender'
            ? 'bg-blue-600 text-white border border-blue-400 ring-1 ring-blue-300/50 shadow-blue-950/40'
            : selectionRole === 'target'
            ? 'bg-rose-600 text-white border border-rose-400 ring-1 ring-rose-300/50 shadow-rose-950/40'
            : selectionRole === 'benefit' || selectionRole === 'buff_target'
            ? 'bg-emerald-600 text-white border border-emerald-400 ring-1 ring-emerald-300 shadow-emerald-950/40'
            : 'bg-amber-500 text-zinc-950 border border-amber-300'
        }`}>
          {selectionBadge}
        </div>
      )}

      {/* Spacebar Zoom Trigger Button (Accessible for Touch & Mouse) */}
      <button
        type="button"
        onClick={handleZoomClick}
        title="Magnify card 3x/5x (or press Spacebar)"
        className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-zinc-900 border border-amber-500/70 text-amber-400 hover:text-white hover:bg-amber-600 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity shadow-md"
      >
        <ZoomIn className="w-3 h-3" />
      </button>

      {/* Top Header: Cost / Prod & State Indicator */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {card.type !== 'Affiliation' && (
            <span className="inline-flex items-center gap-0.5 font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
              <Coins className="w-3 h-3 text-amber-400" />
              {card.cost}
            </span>
          )}
          {card.type === 'Affiliation' && (
            <span className="inline-flex items-center gap-0.5 font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
              <Coins className="w-3 h-3 text-amber-400" />
              +{card.production}/t
            </span>
          )}
          {card.type === 'Location' && card.production && (
            <span className="inline-flex items-center gap-0.5 font-mono px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[10px]">
              +{card.production}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {card.exhausted !== undefined && (
            <span
              className={`font-mono text-[10px] font-bold px-1 rounded ${
                card.exhausted ? 'bg-zinc-800 text-zinc-400' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {card.exhausted ? '(E)' : '(R)'}
            </span>
          )}
        </div>
      </div>

      {/* Card Name and Type */}
      <div className="my-1">
        <div className="flex items-center gap-1">
          {card.isNamed && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
          <h4 className="font-semibold text-zinc-100 truncate text-[12px]" title={card.name}>
            {card.name}
          </h4>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[10px] uppercase tracking-wider font-mono border px-1 rounded ${getTypeBadgeColor()}`}>
            {card.type}
          </span>
          <div className="flex items-center gap-1">
            {(card.isInterrupt || card.abilityText?.toLowerCase().includes('interrupt')) && (
              <span className="text-[9px] font-mono font-bold px-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" title="Interrupt: Can be activated out-of-turn to stop opponent turn and seize initiative">
                ⚡ Interrupt
              </span>
            )}
            {(card.isIntercept || card.abilityText?.toLowerCase().includes('intercept')) && !card.isInterrupt && (
              <span className="text-[9px] font-mono font-bold px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" title="Intercept: Reaction defense">
                🛡️ Intercept
              </span>
            )}
            {card.isNamed && <span className="text-[10px] font-mono text-amber-400/90 font-bold">UNIQUE</span>}
          </div>
        </div>
      </div>

      {/* Operative Combat Stats / Location Capacity */}
      {card.type === 'Operative' && (() => {
        const armorTokens = Math.max(card.powerArmorTokens || 0, card.poweredArmorTokens || 0);
        const tokenBuff = (card.techTokens || 0) + (card.weaponTokens || 0) + (card.suitTokens || 0) + armorTokens + (card.powerSuitTokens || 0);
        const totalOffBonus = (card.tempOffenseBuff || 0) + (card.operationOffenseBuff || 0) + tokenBuff;
        const totalDefBonus = (card.tempDefenseBuff || 0) + (card.operationDefenseBuff || 0) + tokenBuff;
        return (
          <div className="grid grid-cols-2 gap-1 py-1 px-1.5 rounded bg-black/40 border border-zinc-800/80 my-0.5 font-mono text-[11px]">
            <div className="flex items-center gap-1 text-red-300">
              <Sword className="w-3 h-3 text-red-400" />
              <span>{(card.off || 0) + totalOffBonus}</span>
              {totalOffBonus > 0 ? (
                <span className="text-emerald-400 text-[9px]">+{totalOffBonus}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-blue-300 justify-end">
              <Shield className="w-3 h-3 text-blue-400" />
              <span>{(card.def || 0) + totalDefBonus}</span>
              {totalDefBonus > 0 ? (
                <span className="text-emerald-400 text-[9px]">+{totalDefBonus}</span>
              ) : null}
            </div>
          </div>
        );
      })()}

      {/* Skills Badges & Tokens */}
      {card.type === 'Operative' && (
        <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono text-zinc-300 my-0.5">
          {(card.operationOffenseBuff || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50" title="Benefit for one operation">
              ⚔️ 1-Op: +{card.operationOffenseBuff} OFF
            </span>
          )}
          {(card.operationDefenseBuff || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-600/50" title="Benefit for one operation">
              🛡️ 1-Op: +{card.operationDefenseBuff} DEF
            </span>
          )}
          {(card.defendingDefenseBuff || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-blue-950/80 text-blue-300 border border-blue-600/50" title="Benefit when defending against an enemy operation">
              🛡️ +{card.defendingDefenseBuff} DEF (Defending)
            </span>
          )}
          {(card.tempOffenseBuff || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-red-950/60 text-red-300 border border-red-800/40 text-[8px]" title="Temporary: Until end of turn">
              ⏳ +{card.tempOffenseBuff} OFF
            </span>
          )}
          {(card.tempDefenseBuff || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 text-[8px]" title="Temporary: Until end of turn">
              ⏳ +{card.tempDefenseBuff} DEF
            </span>
          )}
          {(card.techTokens || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
              ⚡ Tech: +{card.techTokens}/+{card.techTokens}
            </span>
          )}
          {(card.weaponTokens || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-red-950/80 text-red-300 border border-red-700/50">
              🗡️ Wpn: +{card.weaponTokens}/+{card.weaponTokens}
            </span>
          )}
          {(card.suitTokens || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
              🥋 Suit: +{card.suitTokens}/+{card.suitTokens}
            </span>
          )}
          {Math.max(card.powerArmorTokens || 0, card.poweredArmorTokens || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              🛡️ Power Armor: +{Math.max(card.powerArmorTokens || 0, card.poweredArmorTokens || 0)}/+{Math.max(card.powerArmorTokens || 0, card.poweredArmorTokens || 0)}
            </span>
          )}
          {(card.powerSuitTokens || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-violet-950/80 text-violet-300 border border-violet-700/50">
              🦾 PSuit: +{card.powerSuitTokens}/+{card.powerSuitTokens}
            </span>
          )}
          {card.discardToken && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/60 font-bold animate-pulse">
              ⏳ Discard Token
            </span>
          )}
          {card.appliedTokens && card.appliedTokens.filter(t => t.startsWith('skill_')).map((token, tIdx) => {
            const skName = token === 'skill_ass' ? 'ASS Token' : token === 'skill_raid' ? 'RAID Token' : 'SUB Token';
            const skColor = token === 'skill_ass' ? 'bg-rose-900/90 text-rose-200 border-rose-500/70' : token === 'skill_raid' ? 'bg-amber-900/90 text-amber-200 border-amber-500/70' : 'bg-purple-900/90 text-purple-200 border-purple-500/70';
            return (
              <span key={tIdx} className={`flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-bold shadow-sm border ${skColor}`} title={`+1 ${skName} bestowed by special ability`}>
                ✨ +1 {skName}
              </span>
            );
          })}
          {(card.ass || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/50">
              <Skull className="w-2.5 h-2.5" /> Ass:{card.ass}
            </span>
          )}
          {(card.raid || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/50">
              <Terminal className="w-2.5 h-2.5" /> Raid:{card.raid}
            </span>
          )}
          {(card.sub || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50">
              <Eye className="w-2.5 h-2.5" /> Sub:{card.sub}
            </span>
          )}
        </div>
      )}

      {/* Discard Token for Non-Operatives */}
      {card.type !== 'Operative' && card.discardToken && (
        <div className="flex items-center gap-1 text-[9px] font-mono my-0.5">
          <span className="px-1 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/60 font-bold animate-pulse">
            ⏳ Discard Token (Expires end of turn)
          </span>
        </div>
      )}

      {/* Location / Affiliation Coin Storage */}
      {(card.type === 'Location' || card.type === 'Affiliation') && (
        <div className="flex items-center justify-between text-[10px] font-mono px-1.5 py-1 rounded bg-black/40 border border-zinc-800 my-0.5 text-amber-300">
          <span>Stored Coins:</span>
          <span className="font-bold">{card.stored_coins || 0} / {card.cap}</span>
        </div>
      )}

      {/* Card Ability Description */}
      <p className="text-[10px] leading-tight text-zinc-400 line-clamp-3 my-0.5 font-sans">
        {card.abilityText || (card.type === 'Operative' ? 'Field Operative unit.' : 'Standard deployment card.')}
      </p>

      {/* Play / Activate Button */}
      {isPlayable && onPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className={`mt-1 w-full py-1 text-[11px] font-semibold font-mono rounded text-white transition-colors ${
            playLabel?.includes('FREE') ? 'bg-amber-600 hover:bg-amber-500 font-bold shadow-sm' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {playLabel || `Deploy (${card.cost})`}
        </button>
      )}

      {/* Discard Excess Card Button */}
      {isDiscardable && onDiscard && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDiscard();
          }}
          className="mt-1 w-full py-1 text-[11px] font-semibold font-mono rounded bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm"
        >
          Discard Card
        </button>
      )}
    </div>
  );
};
