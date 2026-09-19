import React from 'react';
import { Card } from '../types/spywar';
import { Shield, Sword, Coins, Skull, Terminal, Eye, Sparkles } from 'lucide-react';

interface CardViewProps {
  card: Card;
  isPlayable?: boolean;
  onPlay?: () => void;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isPlayable = false,
  onPlay,
  onClick,
  selected = false,
  compact = false
}) => {
  const isExhausted = card.exhausted;

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
    if (selected) return 'ring-2 ring-amber-400 border-amber-400 shadow-amber-500/20 shadow-lg';
    if (isPlayable) return 'border-emerald-500/80 hover:border-emerald-400 cursor-pointer shadow-emerald-500/10 shadow-md';
    if (card.isNamed) return 'border-amber-500/60';
    return 'border-zinc-800 hover:border-zinc-700';
  };

  return (
    <div
      onClick={onClick || (isPlayable ? onPlay : undefined)}
      className={`relative group select-none transition-all duration-200 rounded-lg p-2.5 flex flex-col justify-between bg-zinc-900/90 backdrop-blur-sm border ${getBorderColor()} ${
        isExhausted ? 'opacity-60 saturate-50 translate-y-0.5' : ''
      } ${compact ? 'w-36 h-48 text-xs' : 'w-44 h-56 text-xs'}`}
    >
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
      {card.type === 'Operative' && (
        <div className="grid grid-cols-2 gap-1 py-1 px-1.5 rounded bg-black/40 border border-zinc-800/80 my-0.5 font-mono text-[11px]">
          <div className="flex items-center gap-1 text-red-300">
            <Sword className="w-3 h-3 text-red-400" />
            <span>{(card.off || 0) + (card.tempOffenseBuff || 0)}</span>
            {card.tempOffenseBuff ? <span className="text-emerald-400 text-[9px]">+{card.tempOffenseBuff}</span> : null}
          </div>
          <div className="flex items-center gap-1 text-blue-300 justify-end">
            <Shield className="w-3 h-3 text-blue-400" />
            <span>{(card.def || 0) + (card.tempDefenseBuff || 0)}</span>
            {card.tempDefenseBuff ? <span className="text-emerald-400 text-[9px]">+{card.tempDefenseBuff}</span> : null}
          </div>
        </div>
      )}

      {/* Skills Badges */}
      {card.type === 'Operative' && (
        <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono text-zinc-300 my-0.5">
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
          className="mt-1 w-full py-1 text-[11px] font-semibold font-mono rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
        >
          Deploy ({card.cost})
        </button>
      )}
    </div>
  );
};
