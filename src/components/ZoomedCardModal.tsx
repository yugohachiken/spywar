import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCardZoom } from '../context/CardZoomContext';
import {
  X,
  Volume2,
  VolumeX,
  ZoomIn,
  Coins,
  Shield,
  Sword,
  Skull,
  Terminal,
  Eye,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { Card, Mission } from '../types/spywar';

export const ZoomedCardModal: React.FC = () => {
  const { zoomedItem, closeZoom, zoomScale, setZoomScale } = useCardZoom();
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!zoomedItem) return null;

  const isMission = zoomedItem.type === 'Mission';
  const mission = isMission ? (zoomedItem as unknown as Mission) : null;
  const card = !isMission ? (zoomedItem as Card) : null;

  // Read aloud function for visually handicapped players
  const handleReadAloud = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let textToSpeak = '';
    if (card) {
      textToSpeak = `${card.name}. Type: ${card.type}. `;
      if (card.cost) textToSpeak += `Cost: ${card.cost} coins. `;
      if (card.production) textToSpeak += `Production: ${card.production} coins per turn. `;
      if (card.off !== undefined) textToSpeak += `Offense: ${(card.off || 0) + (card.tempOffenseBuff || 0)}. `;
      if (card.def !== undefined) textToSpeak += `Defense: ${(card.def || 0) + (card.tempDefenseBuff || 0)}. `;
      if (card.ass) textToSpeak += `Assassin rank: ${card.ass}. `;
      if (card.raid) textToSpeak += `Raid rank: ${card.raid}. `;
      if (card.sub) textToSpeak += `Subterfuge rank: ${card.sub}. `;
      if (card.abilityText) textToSpeak += `Ability details: ${card.abilityText}. `;
    } else if (mission) {
      textToSpeak = `Mission: ${mission.name}. Reward: ${mission.points} points. Requirement: ${mission.req}. Description: ${mission.description}.`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const getTypeTheme = () => {
    const type = card ? card.type : 'Mission';
    switch (type) {
      case 'Affiliation':
        return {
          badge: 'bg-amber-950 text-amber-300 border-amber-500',
          border: 'border-amber-500/80 shadow-amber-500/30',
          gradient: 'from-amber-950/80 via-zinc-900 to-black',
        };
      case 'Location':
        return {
          badge: 'bg-cyan-950 text-cyan-300 border-cyan-500',
          border: 'border-cyan-500/80 shadow-cyan-500/30',
          gradient: 'from-cyan-950/80 via-zinc-900 to-black',
        };
      case 'Operative':
        return {
          badge: card?.isNamed
            ? 'bg-rose-950 text-rose-300 border-rose-500'
            : 'bg-red-950 text-red-300 border-red-500',
          border: card?.isNamed
            ? 'border-amber-400/90 shadow-amber-500/40'
            : 'border-red-500/80 shadow-red-500/30',
          gradient: 'from-red-950/80 via-zinc-900 to-black',
        };
      case 'Support':
        return {
          badge: 'bg-purple-950 text-purple-300 border-purple-500',
          border: 'border-purple-500/80 shadow-purple-500/30',
          gradient: 'from-purple-950/80 via-zinc-900 to-black',
        };
      case 'Mission':
      default:
        return {
          badge: 'bg-emerald-950 text-emerald-300 border-emerald-500',
          border: 'border-emerald-500/80 shadow-emerald-500/30',
          gradient: 'from-emerald-950/80 via-zinc-900 to-black',
        };
    }
  };

  const theme = getTypeTheme();
  const is5x = zoomScale === '5x';

  return (
    <AnimatePresence>
      <motion.div
        id="card-zoom-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeZoom}
        className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Magnified Card View"
      >
        {/* Top Accessibility & Scale Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl mb-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 shadow-lg text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-amber-400 font-mono">
              <ZoomIn className="w-4 h-4" />
              <span>Card Magnifier</span>
            </span>
            <span className="hidden sm:inline text-zinc-400">&bull;</span>
            <span className="hidden sm:inline text-zinc-400">
              Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 font-mono font-bold">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 font-mono font-bold">Esc</kbd> to exit
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 3x vs 5x Toggle */}
            <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 font-mono font-bold text-xs">
              <button
                type="button"
                onClick={() => setZoomScale('3x')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  !is5x
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="3x Magnification"
              >
                3x Zoom
              </button>
              <button
                type="button"
                onClick={() => setZoomScale('5x')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  is5x
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="5x Large-Print Magnification"
              >
                5x Zoom
              </button>
            </div>

            {/* Read Aloud (Screen-reader support) */}
            {'speechSynthesis' in window && (
              <button
                type="button"
                onClick={handleReadAloud}
                className={`px-2.5 py-1 rounded-lg border font-mono font-semibold flex items-center gap-1.5 transition-colors ${
                  isSpeaking
                    ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                }`}
                title="Read card details out loud"
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
                <span className="hidden md:inline">{isSpeaking ? 'Stop Audio' : 'Read Aloud'}</span>
              </button>
            )}

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={closeZoom}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700 transition-colors"
              title="Close Magnifier (Space or Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Magnified Card Container */}
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 15 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className={`relative rounded-2xl bg-gradient-to-b ${theme.gradient} border-2 ${
            theme.border
          } shadow-2xl p-6 sm:p-8 flex flex-col justify-between select-none max-h-[86vh] overflow-y-auto ${
            is5x
              ? 'w-full max-w-2xl sm:max-w-3xl min-h-[580px]'
              : 'w-full max-w-md sm:max-w-lg min-h-[460px]'
          }`}
        >
          {/* Card Top Row: Cost & Exhaustion / Status */}
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                {card && card.type !== 'Affiliation' && (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border-2 border-amber-500/40 font-mono font-extrabold text-base sm:text-lg shadow-sm">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span>Cost: {card.cost}</span>
                  </div>
                )}
                {card && card.type === 'Affiliation' && (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border-2 border-amber-500/40 font-mono font-extrabold text-base sm:text-lg shadow-sm">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span>+{card.production} Coins / Turn</span>
                  </div>
                )}
                {card && card.type === 'Location' && card.production && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold text-sm">
                    <span>+{card.production} Prod</span>
                  </div>
                )}
                {mission && (
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500/40 font-mono font-extrabold text-base sm:text-lg shadow-sm">
                    <span>+{mission.points} Mission Points</span>
                  </div>
                )}
              </div>

              {card?.exhausted !== undefined && (
                <div
                  className={`font-mono text-sm font-bold px-3 py-1 rounded-lg border ${
                    card.exhausted
                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  }`}
                >
                  {card.exhausted ? 'Exhausted (E)' : 'Ready (R)'}
                </div>
              )}
            </div>

            {/* Card Name & Type Header */}
            <div className="mt-4 mb-3">
              <div className="flex items-center gap-2">
                {card?.isNamed && <Sparkles className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />}
                <h2
                  className={`font-black tracking-tight text-white ${
                    is5x ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                  }`}
                >
                  {card?.name || mission?.name}
                </h2>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`uppercase tracking-wider font-mono font-bold px-2.5 py-0.5 rounded-md border text-xs sm:text-sm ${theme.badge}`}
                >
                  {card ? card.type : 'Mission Objective'}
                </span>
                {card?.isNamed && (
                  <span className="font-mono text-xs sm:text-sm text-amber-400 font-extrabold px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60">
                    UNIQUE LEGENDARY OPERATIVE
                  </span>
                )}
              </div>
            </div>

            {/* Operative Combat Stats (Big 32px Font) */}
            {card?.type === 'Operative' && (
              <div className="my-4 grid grid-cols-2 gap-3 p-3.5 sm:p-4 rounded-xl bg-black/60 border border-zinc-800 font-mono">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-950/80 border border-red-600/50">
                    <Sword className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-red-300 font-semibold">Offense</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-red-200">
                      {(card.off || 0) + (card.tempOffenseBuff || 0)}
                      {card.tempOffenseBuff ? (
                        <span className="text-emerald-400 text-sm ml-1 font-bold">+{card.tempOffenseBuff}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-blue-300 font-semibold">Defense</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-blue-200">
                      {(card.def || 0) + (card.tempDefenseBuff || 0)}
                      {card.tempDefenseBuff ? (
                        <span className="text-emerald-400 text-sm ml-1 font-bold">+{card.tempDefenseBuff}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-600/50">
                    <Shield className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Espionage Specialized Skills Badges */}
            {card?.type === 'Operative' && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(card.ass || 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border-2 border-rose-700/60 font-mono font-bold text-xs sm:text-sm">
                    <Skull className="w-4 h-4 text-rose-400" />
                    <span>Assassin Rank {card.ass}</span>
                  </div>
                )}
                {(card.raid || 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950 text-amber-300 border-2 border-amber-700/60 font-mono font-bold text-xs sm:text-sm">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    <span>Raid Rank {card.raid}</span>
                  </div>
                )}
                {(card.sub || 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950 text-purple-300 border-2 border-purple-700/60 font-mono font-bold text-xs sm:text-sm">
                    <Eye className="w-4 h-4 text-purple-400" />
                    <span>Subterfuge Rank {card.sub}</span>
                  </div>
                )}
              </div>
            )}

            {/* Stored Coins for Location or Affiliation */}
            {card && (card.type === 'Location' || card.type === 'Affiliation') && (
              <div className="p-3.5 rounded-xl bg-black/60 border border-amber-500/30 my-3 font-mono">
                <div className="flex items-center justify-between text-xs sm:text-sm text-amber-300 font-bold mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Stored Bank Coins:
                  </span>
                  <span className="text-base sm:text-lg">
                    {card.stored_coins || 0} / {card.cap}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, ((card.stored_coins || 0) / (card.cap || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Mission Progress */}
            {mission && (
              <div className="p-3.5 rounded-xl bg-black/60 border border-emerald-500/30 my-3 font-mono space-y-2">
                <div className="text-xs text-zinc-300 font-bold">Requirement Target: {mission.req}</div>
                <div className="flex items-center justify-between text-xs text-blue-300">
                  <span>Player 1 Progress:</span>
                  <span className="font-bold">{mission.tokens.P1 || 0} / {mission.req}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-rose-300">
                  <span>Player 2 Progress:</span>
                  <span className="font-bold">{mission.tokens.P2 || 0} / {mission.req}</span>
                </div>
              </div>
            )}

            {/* Card Ability Description (Large Print 18px-22px) */}
            <div className="mt-4 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Tactical Intelligence &amp; Rules:
              </div>
              <p
                className={`text-zinc-100 font-sans leading-relaxed ${
                  is5x ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
                }`}
              >
                {card?.abilityText ||
                  mission?.description ||
                  (card?.type === 'Operative'
                    ? 'Field operative ready for combat, defensive intercepts, and tactical operations.'
                    : 'Standard espionage intelligence card.')}
              </p>
            </div>
          </div>

          {/* Bottom Controls / Keyboard Dismiss Note */}
          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span>SPYWAR Accessibility Zoom</span>
            <button
              type="button"
              onClick={closeZoom}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold flex items-center gap-1.5 transition-colors shadow-md shadow-amber-500/20"
            >
              <span>Close View</span>
              <kbd className="px-1 py-0.5 rounded bg-amber-600/30 text-zinc-900 text-[10px]">Space</kbd>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
