import React, { useState, useMemo } from 'react';
import { Card, CardType } from '../types/spywar';
import { CardDatabaseService, DeckPreset } from '../services/cardDatabaseService';
import { 
  Layers, 
  Play, 
  Plus, 
  Minus, 
  Trash2, 
  Bookmark, 
  Save, 
  RotateCcw, 
  Check, 
  Search, 
  AlertTriangle, 
  Coins, 
  Swords, 
  Shield, 
  Sliders,
  ChevronRight,
  Info
} from 'lucide-react';

interface DeckBuilderProps {
  onPlayWithDeck: (customDeckPayload: {
    affiliationDeck: Card[];
    drawDeck: Card[];
    missions: any[];
    deckName: string;
  }) => void;
  onNavigateToCardEditor?: () => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ onPlayWithDeck, onNavigateToCardEditor }) => {
  const cardDb = useMemo(() => CardDatabaseService.getInstance(), []);
  const [activeDeck, setActiveDeck] = useState<DeckPreset>(() => cardDb.getActiveDeck());
  const [presets, setPresets] = useState<DeckPreset[]>(() => cardDb.getAllPresets());
  const [allCards, setAllCards] = useState<Card[]>(() => cardDb.getAllCards());
  
  // Library filters
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Save preset modal
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const refreshState = () => {
    setActiveDeck(cardDb.getActiveDeck());
    setPresets(cardDb.getAllPresets());
    setAllCards(cardDb.getAllCards());
  };

  const cardMap = useMemo(() => {
    return new Map<string, Card>(allCards.map(c => [c.id, c]));
  }, [allCards]);

  // Handle preset change
  const handleSelectPreset = (presetId: string) => {
    const found = presets.find(p => p.id === presetId);
    if (found) {
      cardDb.setActiveDeck(found);
      refreshState();
      showToast(`Loaded deck preset: ${found.name}`);
    }
  };

  // Adjust card quantity
  const handleAdjustQty = (cardId: string, delta: number) => {
    const current = activeDeck.cardQuantities[cardId] || 0;
    const next = Math.max(0, current + delta);
    cardDb.updateActiveDeckQuantity(cardId, next);
    refreshState();
  };

  // Toggle affiliation
  const handleToggleAffiliation = (affId: string) => {
    cardDb.toggleActiveDeckAffiliation(affId);
    refreshState();
  };

  // Save as new preset
  const handleSaveAsPreset = () => {
    if (!newPresetName.trim()) {
      alert('Please enter a name for the preset.');
      return;
    }
    const created = cardDb.saveNewPreset(newPresetName.trim(), newPresetDesc.trim() || 'Custom engineered player deck.');
    refreshState();
    setShowSavePresetModal(false);
    setNewPresetName('');
    setNewPresetDesc('');
    showToast(`Saved new preset: ${created.name}`);
  };

  // Delete preset
  const handleDeletePreset = (id: string) => {
    if (window.confirm('Delete this custom preset?')) {
      cardDb.deletePreset(id);
      refreshState();
      showToast('Preset deleted.');
    }
  };

  // Calculate deck statistics
  const deckStats = useMemo(() => {
    let totalCards = 0;
    let opCount = 0;
    let locCount = 0;
    let supCount = 0;
    let totalCost = 0;
    let totalOff = 0;
    let totalDef = 0;
    let totalAss = 0;
    let totalRaid = 0;
    let totalSub = 0;

    for (const [cardId, rawQty] of Object.entries(activeDeck.cardQuantities)) {
      const qty = Number(rawQty) || 0;
      if (qty <= 0) continue;
      const card = cardMap.get(cardId);
      if (!card || card.type === 'Affiliation') continue;

      totalCards += qty;
      totalCost += (card.cost || 0) * qty;

      if (card.type === 'Operative') {
        opCount += qty;
        totalOff += (card.off || 1) * qty;
        totalDef += (card.def || 1) * qty;
        totalAss += (card.ass || 0) * qty;
        totalRaid += (card.raid || 0) * qty;
        totalSub += (card.sub || 0) * qty;
      } else if (card.type === 'Location') {
        locCount += qty;
      } else if (card.type === 'Support') {
        supCount += qty;
      }
    }

    const avgCost = totalCards > 0 ? (totalCost / totalCards).toFixed(1) : '0.0';
    return {
      totalCards,
      opCount,
      locCount,
      supCount,
      avgCost,
      totalOff,
      totalDef,
      totalAss,
      totalRaid,
      totalSub
    };
  }, [activeDeck, cardMap]);

  // Filtered library cards
  const filteredLibrary = useMemo(() => {
    return allCards.filter(c => {
      if (c.type === 'Affiliation') return false; // Affiliations handled separately in drafting pool
      const matchesType = libraryTypeFilter === 'All' || c.type === libraryTypeFilter;
      const matchesSearch = searchQuery.trim() === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.abilityText && c.abilityText.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [allCards, libraryTypeFilter, searchQuery]);

  // Affiliations list
  const affiliationsList = useMemo(() => {
    return allCards.filter(c => c.type === 'Affiliation');
  }, [allCards]);

  // Launch game with current deck
  const handleLaunchGame = () => {
    if (deckStats.totalCards < 6) {
      alert('Deck must contain at least 6 cards to play a match.');
      return;
    }
    const deckData = cardDb.generateGameDeckForEngine();
    onPlayWithDeck({
      ...deckData,
      deckName: activeDeck.name
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Preset Controls */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
                Deck Builder &amp; Match Architect
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-amber-400 font-mono border border-zinc-700">
                  {deckStats.totalCards} Draw Cards
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Design custom card inclusion, set exact copy counts, configure affiliation draft pools, and test live in match play.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-700">
            <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={activeDeck.id}
              onChange={e => handleSelectPreset(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                  {p.name} {p.isBuiltIn ? '(Default)' : '(Custom)'}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowSavePresetModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
            title="Save active deck configuration as a custom preset"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span>Save Preset</span>
          </button>

          {!activeDeck.isBuiltIn && (
            <button
              onClick={() => handleDeletePreset(activeDeck.id)}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-all"
              title="Delete this custom preset"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Play with Deck Button */}
          <button
            onClick={handleLaunchGame}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>Play Match With This Deck</span>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Deck Diagnostics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Draw Deck Total</span>
          <div className="text-xl font-bold text-white mt-1 flex items-baseline gap-1">
            {deckStats.totalCards}
            <span className="text-[11px] font-normal text-zinc-500">cards</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Type Distribution</span>
          <div className="text-xs font-mono text-zinc-200 mt-1 flex items-center gap-1.5">
            <span className="text-amber-400 font-bold">{deckStats.opCount} Op</span> /{' '}
            <span className="text-emerald-400 font-bold">{deckStats.locCount} Loc</span> /{' '}
            <span className="text-cyan-400 font-bold">{deckStats.supCount} Sup</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Average Cost</span>
          <div className="text-xl font-bold text-amber-300 mt-1 flex items-center gap-1">
            <Coins className="w-4 h-4 text-amber-400" />
            {deckStats.avgCost}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Total Combat Power</span>
          <div className="text-xs font-mono text-zinc-200 mt-1 flex items-center gap-2">
            <span className="text-rose-400 flex items-center gap-0.5">
              <Swords className="w-3 h-3" /> {deckStats.totalOff} OFF
            </span>
            <span className="text-blue-400 flex items-center gap-0.5">
              <Shield className="w-3 h-3" /> {deckStats.totalDef} DEF
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Specialist Skills</span>
          <div className="text-xs font-mono text-zinc-300 mt-1 flex items-center gap-2">
            <span className="text-rose-300">{deckStats.totalAss} ASS</span>
            <span className="text-amber-300">{deckStats.totalRaid} RAID</span>
            <span className="text-purple-300">{deckStats.totalSub} SUB</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Deck Status</span>
          <div className="mt-1">
            {deckStats.totalCards >= 25 ? (
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Optimal Deck Size
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Small Deck (&lt;25)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Affiliations Drafting Pool */}
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase font-bold text-zinc-300 tracking-wider flex items-center gap-1.5">
            Eligible Starting Affiliations (Draft Pool)
          </h3>
          <span className="text-[11px] text-zinc-500">
            {activeDeck.enabledAffiliations.length} / {affiliationsList.length} enabled
          </span>
        </div>
        <p className="text-[11px] text-zinc-400">
          Players are randomly drafted an Affiliation from this pool during setup. Select at least 2.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {affiliationsList.map(aff => {
            const isEnabled = activeDeck.enabledAffiliations.includes(aff.id);
            return (
              <button
                key={aff.id}
                onClick={() => handleToggleAffiliation(aff.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                  isEnabled
                    ? 'bg-rose-950/40 text-rose-200 border-rose-500/50 shadow-sm'
                    : 'bg-zinc-950/60 text-zinc-500 border-zinc-800 opacity-60 hover:opacity-90'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-rose-500' : 'bg-zinc-600'}`} />
                <span>{aff.name}</span>
                <span className="text-[10px] font-mono text-zinc-400">+{aff.production} Prod</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Dual Columns: Left = Card Library, Right = Active Decklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Card Library (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
              {['All', 'Operative', 'Location', 'Support'].map(type => (
                <button
                  key={type}
                  onClick={() => setLibraryTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    libraryTypeFilter === type
                      ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search library..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Library Cards List */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredLibrary.map(card => {
              const currentQty = activeDeck.cardQuantities[card.id] || 0;
              const isOperative = card.type === 'Operative';
              const isLocation = card.type === 'Location';

              return (
                <div
                  key={card.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 bg-zinc-900/40 hover:bg-zinc-900/80 ${
                    currentQty > 0 ? 'border-zinc-700 bg-zinc-900/70' : 'border-zinc-800/80'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        isOperative ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        isLocation ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}>
                        {card.type}
                      </span>
                      <h4 className="font-semibold text-xs text-white truncate">{card.name}</h4>
                      {card.cost > 0 && (
                        <span className="text-[11px] font-mono text-amber-400 flex items-center gap-0.5">
                          <Coins className="w-3 h-3" /> {card.cost}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {isOperative ? (
                        <span>
                          {card.off}/{card.def}
                          {card.ass ? ` • ASS ${card.ass}` : ''}
                          {card.raid ? ` • RAID ${card.raid}` : ''}
                          {card.sub ? ` • SUB ${card.sub}` : ''}
                        </span>
                      ) : isLocation ? (
                        <span>+{card.production} Prod • {card.cap} Cap</span>
                      ) : (
                        <span>{card.abilityText}</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Counter & Add button */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {currentQty > 0 ? (
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-700">
                        <button
                          onClick={() => handleAdjustQty(card.id, -1)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-mono font-bold text-white w-4 text-center">
                          {currentQty}
                        </span>
                        <button
                          onClick={() => handleAdjustQty(card.id, 1)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAdjustQty(card.id, 1)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-cyan-500/20 text-zinc-300 hover:text-cyan-300 border border-zinc-700 text-xs font-medium transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Decklist (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>Current Decklist</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-cyan-400">
                    {deckStats.totalCards} cards
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Included in the draw deck during play
                </p>
              </div>

              {onNavigateToCardEditor && (
                <button
                  onClick={onNavigateToCardEditor}
                  className="text-[11px] text-amber-400 hover:text-amber-300 underline font-mono"
                >
                  Edit Card Stats
                </button>
              )}
            </div>

            {/* Deck List Items */}
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {Object.entries(activeDeck.cardQuantities)
                .filter(([_, qty]) => Number(qty) > 0)
                .map(([cardId, rawQty]) => {
                  const qty = Number(rawQty);
                  const card = cardMap.get(cardId);
                  if (!card) return null;

                  return (
                    <div
                      key={cardId}
                      className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/90 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-mono px-1 py-0.5 rounded uppercase font-bold ${
                            card.type === 'Operative' ? 'bg-amber-500/10 text-amber-400' :
                            card.type === 'Location' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-cyan-500/10 text-cyan-400'
                          }`}>
                            {card.type.slice(0, 3)}
                          </span>
                          <span className="font-medium text-xs text-white truncate">{card.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleAdjustQty(cardId, -1)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                          title="Decrease copies"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="text-xs font-mono font-bold text-amber-400 w-5 text-center">
                          {qty}x
                        </span>

                        <button
                          onClick={() => handleAdjustQty(cardId, 1)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                          title="Increase copies"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleAdjustQty(cardId, -qty)}
                          className="p-1 rounded text-zinc-600 hover:text-rose-400 ml-1"
                          title="Remove all copies from deck"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {deckStats.totalCards === 0 && (
                <div className="py-12 text-center text-zinc-500 text-xs italic">
                  No cards in active deck. Click "+ Add" on cards in the library.
                </div>
              )}
            </div>

            {/* Bottom Action */}
            <div className="pt-3 border-t border-zinc-800">
              <button
                onClick={handleLaunchGame}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Play Match With This Deck ({deckStats.totalCards} cards)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Preset Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">Save Current Deck as Preset</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Preset Name</label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  placeholder="e.g. My Tournament Deck"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newPresetDesc}
                  onChange={e => setNewPresetDesc(e.target.value)}
                  placeholder="Notes about strategy, card synergies, or playstyle..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsPreset}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md shadow-amber-500/20"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
