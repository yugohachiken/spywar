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
  selectionRole?: 'attacker' | 'defender' | 'target';
  selectionBadge?: string;
  compact?: boolean;
  playLabel?: string;
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
  playLabel
}) => {
  const { setHighlightedItem, clearHighlightedItem, openZoom, highlightedItem } = useCardZoom();
  const isExhausted = card.exhausted;
  const isCurrentlyHighlighted = highlightedItem?.id === card.id;

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
      if (selectionRole === 'defender') {
        return 'ring-2 ring-blue-400 border-blue-400 shadow-blue-500/30 shadow-lg';
      }
      if (selectionRole === 'target') {
        return 'ring-2 ring-rose-500 border-rose-500 shadow-rose-500/30 shadow-lg animate-pulse';
      }
      return 'ring-2 ring-amber-400 border-amber-400 shadow-amber-500/20 shadow-lg';
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
      className={`relative group select-none transition-all duration-200 rounded-lg p-2.5 flex flex-col justify-between bg-zinc-900/90 backdrop-blur-sm border outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${getBorderColor()} ${
        isExhausted ? 'opacity-60 saturate-50 translate-y-0.5' : ''
      } ${compact ? 'w-36 h-48 text-xs' : 'w-44 h-56 text-xs'}`}
    >
      {/* Selection Role / Multi-Select Badge */}
      {selectionBadge && (
        <div className={`absolute -top-2.5 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider shadow-md ${
          selectionRole === 'defender'
            ? 'bg-blue-600 text-white border border-blue-400'
            : selectionRole === 'target'
            ? 'bg-rose-600 text-white border border-rose-400'
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
          {card.isNamed && <span className="text-[10px] font-mono text-amber-400/90 font-bold">UNIQUE</span>}
        </div>
      </div>

      {/* Operative Combat Stats / Location Capacity */}
      {card.type === 'Operative' && (() => {
        const tokenBuff = (card.techTokens || 0) + (card.weaponTokens || 0) + (card.suitTokens || 0) + (card.poweredArmorTokens || 0) + (card.powerSuitTokens || 0);
        return (
          <div className="grid grid-cols-2 gap-1 py-1 px-1.5 rounded bg-black/40 border border-zinc-800/80 my-0.5 font-mono text-[11px]">
            <div className="flex items-center gap-1 text-red-300">
              <Sword className="w-3 h-3 text-red-400" />
              <span>{(card.off || 0) + (card.tempOffenseBuff || 0) + tokenBuff}</span>
              {(card.tempOffenseBuff || 0) + tokenBuff > 0 ? (
                <span className="text-emerald-400 text-[9px]">+{(card.tempOffenseBuff || 0) + tokenBuff}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-blue-300 justify-end">
              <Shield className="w-3 h-3 text-blue-400" />
              <span>{(card.def || 0) + (card.tempDefenseBuff || 0) + tokenBuff}</span>
              {(card.tempDefenseBuff || 0) + tokenBuff > 0 ? (
                <span className="text-emerald-400 text-[9px]">+{(card.tempDefenseBuff || 0) + tokenBuff}</span>
              ) : null}
            </div>
          </div>
        );
      })()}

      {/* Skills Badges & Tokens */}
      {card.type === 'Operative' && (
        <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono text-zinc-300 my-0.5">
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
          {(card.poweredArmorTokens || 0) > 0 && (
            <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              🛡️ Armor: +{card.poweredArmorTokens}/+{card.poweredArmorTokens}
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
