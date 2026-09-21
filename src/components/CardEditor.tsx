import React, { useState, useMemo } from 'react';
import { Card, CardType } from '../types/spywar';
import { CardDatabaseService } from '../services/cardDatabaseService';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  RotateCcw, 
  Download, 
  Upload, 
  Search, 
  Sparkles, 
  Shield, 
  Swords, 
  Coins, 
  Layers, 
  Check, 
  AlertCircle,
  X,
  Lock,
  Unlock,
  GitBranch,
  Copy,
  ShieldAlert
} from 'lucide-react';

interface CardEditorProps {
  onDeckOrCardUpdated?: () => void;
  onNavigateToDeckBuilder?: () => void;
}

export const CardEditor: React.FC<CardEditorProps> = ({ onDeckOrCardUpdated, onNavigateToDeckBuilder }) => {
  const cardDb = useMemo(() => CardDatabaseService.getInstance(), []);
  const [cards, setCards] = useState<Card[]>(() => cardDb.getAllCards());
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / Drawer state
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isBranchingOriginal, setIsBranchingOriginal] = useState(false);
  const [sourceOriginalCard, setSourceOriginalCard] = useState<Card | null>(null);
  const [saveOriginalMode, setSaveOriginalMode] = useState<'overwrite' | 'branch'>('overwrite');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDeletedOriginalsModal, setShowDeletedOriginalsModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshList = () => {
    const updated = cardDb.getAllCards();
    setCards(updated);
    if (onDeckOrCardUpdated) onDeckOrCardUpdated();
  };

  const deletedOriginals = useMemo(() => {
    return cardDb.getDeletedOriginalCards();
  }, [cards, cardDb]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      const matchesType = selectedTypeFilter === 'All' || c.type === selectedTypeFilter;
      const matchesSearch = searchQuery.trim() === '' || 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.abilityText && c.abilityText.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [cards, selectedTypeFilter, searchQuery]);

  // Handle open editor for existing card
  const handleEdit = (card: Card) => {
    const isOriginal = cardDb.isOriginalCard(card.id);
    setIsCreatingNew(false);

    if (isOriginal) {
      setIsBranchingOriginal(true);
      setSourceOriginalCard(card);
      setSaveOriginalMode('overwrite'); // default to direct overwrite/replace original
      setEditingCard({
        ...card,
      });
    } else {
      setIsBranchingOriginal(false);
      setSourceOriginalCard(null);
      setEditingCard({ ...card });
    }
  };

  // Direct fast clone / branch
  const handleQuickBranch = (card: Card) => {
    const branched = cardDb.branchCard(card.id);
    if (branched) {
      refreshList();
      showNotify(`Branched '${branched.name}' into custom cards!`);
    }
  };

  // Handle open creator for new card
  const handleCreateNew = (type: CardType = 'Operative') => {
    setIsCreatingNew(true);
    setIsBranchingOriginal(false);
    setSourceOriginalCard(null);
    const newCard: Card = {
      id: `custom_${type.toLowerCase()}_${Date.now()}`,
      name: `New ${type}`,
      type,
      cost: (type === 'Affiliation' || type === 'Mission') ? 0 : 2,
      qty: (type === 'Affiliation' || type === 'Mission') ? 1 : 2,
      off: type === 'Operative' ? 2 : undefined,
      def: type === 'Operative' ? 2 : undefined,
      ass: type === 'Operative' ? 0 : undefined,
      raid: type === 'Operative' ? 0 : undefined,
      sub: type === 'Operative' ? 0 : undefined,
      production: (type === 'Location' || type === 'Affiliation') ? 2 : undefined,
      cap: (type === 'Location' || type === 'Affiliation') ? 2 : undefined,
      points: type === 'Mission' ? 1 : undefined,
      req: type === 'Mission' ? 1 : undefined,
      missionType: type === 'Mission' ? 'kills' : undefined,
      abilityText: 'Card rules and special instructions here.',
      isOriginal: false,
    };
    setEditingCard(newCard);
  };

  // Save Card
  const handleSaveCard = () => {
    if (!editingCard) return;
    if (!editingCard.name.trim()) {
      alert('Card name cannot be empty.');
      return;
    }

    const isOriginal = cardDb.isOriginalCard(editingCard.id);
    const overwriteOriginal = isOriginal && saveOriginalMode === 'overwrite';

    const { savedCard, branched } = cardDb.saveCard(editingCard, { overwriteOriginal });
    refreshList();
    setEditingCard(null);
    setIsBranchingOriginal(false);
    setSourceOriginalCard(null);

    if (branched) {
      showNotify(`Branched '${savedCard.name}' into a new custom card version!`);
    } else if (overwriteOriginal) {
      showNotify(`Updated original card '${savedCard.name}' with your modifications!`);
    } else {
      showNotify(`Card '${savedCard.name}' successfully saved!`);
    }
  };

  // Delete Card
  const handleDeleteCard = (id: string) => {
    const isOriginal = cardDb.isOriginalCard(id);
    const success = cardDb.deleteCard(id);
    if (success) {
      refreshList();
      setDeleteConfirmId(null);
      showNotify(
        isOriginal 
          ? 'Original card deleted from card pool and decks. You can restore it anytime.' 
          : 'Card successfully deleted from database and decks.'
      );
    }
  };

  // Restore single original card
  const handleRestoreCard = (id: string) => {
    const restored = cardDb.restoreOriginalCard(id);
    if (restored) {
      refreshList();
      showNotify(`Restored '${restored.name}' to the card pool.`);
    }
  };

  // Restore all original cards
  const handleRestoreAllOriginals = () => {
    const restored = cardDb.restoreAllOriginalCards();
    refreshList();
    setShowDeletedOriginalsModal(false);
    showNotify(`Restored all ${restored.length} original cards to the card pool.`);
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    if (window.confirm('Reset all cards and decks to official factory defaults? Any custom cards will be erased and all deleted original cards restored.')) {
      cardDb.resetCardsToDefault();
      refreshList();
      showNotify('Cards reset to official factory defaults.');
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    const json = cardDb.exportDatabaseJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spywar-cards-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotify('Card database exported to JSON.');
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = cardDb.importDatabaseJSON(content);
      if (res.success) {
        refreshList();
        showNotify(res.message);
      } else {
        alert(res.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-lg text-white tracking-tight">
                  Card Editor &amp; Creator
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">
                  {cards.length} Cards in Manifest
                </span>
                {deletedOriginals.length > 0 && (
                  <button
                    onClick={() => setShowDeletedOriginalsModal(true)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30 flex items-center gap-1 transition-all"
                  >
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    {deletedOriginals.length} Deleted Original{deletedOriginals.length > 1 ? 's' : ''} (Restore)
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Full card database control: create, edit, replace, or delete any cards in your game engine manifest. Deleted original cards can be restored at any time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {deletedOriginals.length > 0 && (
            <button
              onClick={() => setShowDeletedOriginalsModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Restore Originals ({deletedOriginals.length})</span>
            </button>
          )}

          <button
            onClick={() => handleCreateNew('Operative')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Card</span>
          </button>

          {onNavigateToDeckBuilder && (
            <button
              onClick={onNavigateToDeckBuilder}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Open Deck Builder</span>
            </button>
          )}

          <div className="flex items-center gap-1 border-l border-zinc-800 pl-2">
            <button
              onClick={handleExportJSON}
              title="Export database to JSON file"
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all"
            >
              <Download className="w-4 h-4" />
            </button>
            <label
              title="Import cards from JSON"
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
            <button
              onClick={handleResetDefaults}
              title="Reset all cards to factory defaults"
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 border border-zinc-700/60 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/80">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['All', 'Operative', 'Location', 'Support', 'Affiliation', 'Mission'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTypeFilter === type
                  ? 'bg-amber-500 text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {type === 'All' ? `All (${cards.length})` : `${type}s (${cards.filter(c => c.type === type).length})`}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cards, skills, rules..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCards.map(card => {
          const isOperative = card.type === 'Operative';
          const isLocation = card.type === 'Location';
          const isAffiliation = card.type === 'Affiliation';
          const isSupport = card.type === 'Support';
          const isMission = card.type === 'Mission';
          const isOriginal = cardDb.isOriginalCard(card.id) || !!card.isOriginal;

          return (
            <div
              key={card.id}
              className={`rounded-xl border p-4 flex flex-col justify-between transition-all bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 ${
                isOperative ? 'border-amber-500/20' :
                isLocation ? 'border-emerald-500/20' :
                isAffiliation ? 'border-rose-500/20' :
                isMission ? 'border-purple-500/30' :
                'border-cyan-500/20'
              }`}
            >
              <div>
                {/* Header: Type, Status and Cost */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                      isOperative ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                      isLocation ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                      isAffiliation ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                      isMission ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                      'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      {card.type} {card.isNamed ? '★ Unique' : ''}
                    </span>

                    {card.isModifiedOriginal ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5" title="Modified original card">
                        <Check className="w-2.5 h-2.5 text-emerald-400" /> Modified Original
                      </span>
                    ) : isOriginal ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300/90 border border-amber-500/20 flex items-center gap-0.5" title="Core original card">
                        <Lock className="w-2.5 h-2.5 text-amber-400" /> Original
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 flex items-center gap-0.5" title="Custom card branch">
                        <GitBranch className="w-2.5 h-2.5 text-cyan-400" /> Custom
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-zinc-400">Qty:</span>
                    <span className="text-zinc-200 font-bold">{card.qty || 1}</span>
                    {card.cost > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-0.5">
                        <Coins className="w-3 h-3 text-amber-400" />
                        {card.cost}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Title */}
                <h3 className="font-bold text-sm text-white mb-1.5 line-clamp-1">{card.name}</h3>

                {/* Stat Badges for Operatives */}
                {isOperative && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-200 border border-zinc-700 flex items-center gap-1">
                      <Swords className="w-3 h-3 text-rose-400" />
                      OFF: <strong>{card.off ?? 1}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-200 border border-zinc-700 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-400" />
                      DEF: <strong>{card.def ?? 1}</strong>
                    </span>

                    {(card.ass || 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-950/40 text-[10px] font-mono text-rose-300 border border-rose-500/30">
                        ASS: {card.ass}
                      </span>
                    )}
                    {(card.raid || 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                        RAID: {card.raid}
                      </span>
                    )}
                    {(card.sub || 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/40 text-[10px] font-mono text-purple-300 border border-purple-500/30">
                        SUB: {card.sub}
                      </span>
                    )}
                  </div>
                )}

                {/* Stat Badges for Locations / Affiliations */}
                {(isLocation || isAffiliation) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-[11px] font-mono text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-emerald-400" />
                      Prod: <strong>+{card.production ?? 0}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300 border border-zinc-700">
                      Cap: <strong>{card.cap ?? 0}</strong>
                    </span>
                  </div>
                )}

                {/* Stat Badges for Missions */}
                {isMission && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-purple-950/40 text-[11px] font-mono text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      Pts: <strong>{card.points ?? 1}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300 border border-zinc-700">
                      Req: <strong>{card.req ?? 1}</strong>
                    </span>
                    {card.missionType && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700">
                        {card.missionType}
                      </span>
                    )}
                  </div>
                )}

                {/* Rules / Ability Text */}
                <p className="text-xs text-zinc-300 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/80 min-h-[48px] leading-relaxed">
                  {card.abilityText || <span className="italic text-zinc-500">No special text</span>}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[110px]" title={`ID: ${card.id}`}>
                  {card.id}
                </span>

                <div className="flex items-center gap-1">
                  {isOriginal ? (
                    <button
                      onClick={() => handleEdit(card)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm"
                      title="Edit this original card (modify in-place or branch as copy)"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEdit(card)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-cyan-500/20 text-zinc-200 hover:text-cyan-300 border border-zinc-700 hover:border-cyan-500/30 text-xs font-medium transition-all"
                      title="Edit this custom card"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleQuickBranch(card)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-all"
                    title="Duplicate into a new custom branch"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(card.id)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-all"
                    title={isOriginal ? "Delete original card from card pool (can be restored later)" : "Delete custom card"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-zinc-900/30 border border-dashed border-zinc-800">
          <AlertCircle className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No cards found matching your search or filters.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const targetCard = cards.find(c => c.id === deleteConfirmId);
        const isDeletingOriginal = targetCard ? (cardDb.isOriginalCard(targetCard.id) || !!targetCard.isOriginal) : false;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isDeletingOriginal ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-white">
                  {isDeletingOriginal ? 'Delete Original Card?' : 'Delete Card?'}
                </h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDeletingOriginal ? (
                  <>
                    Are you sure you want to remove original card <strong>&quot;{targetCard?.name}&quot;</strong>? It will be removed from your card pool and active decks so your modified cards can replace it. You can restore it anytime from the <strong>Restore Originals</strong> menu.
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete <strong>&quot;{targetCard?.name}&quot;</strong>? It will also be removed from any active decks.
                  </>
                )}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCard(deleteConfirmId)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20"
                >
                  {isDeletingOriginal ? 'Delete Original' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Card Editor / Creator Modal */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  isBranchingOriginal ? 'bg-amber-500/20 text-amber-400' :
                  isCreatingNew ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {isBranchingOriginal ? <Edit3 className="w-5 h-5" /> :
                   isCreatingNew ? <Plus className="w-5 h-5" /> : 
                   <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    {isBranchingOriginal ? `Edit Original: ${sourceOriginalCard?.name || editingCard.name}` :
                     isCreatingNew ? 'Create New Card' : 
                     `Edit: ${editingCard.name}`}
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    {isBranchingOriginal 
                      ? (saveOriginalMode === 'overwrite' ? `Card ID: ${editingCard.id} (In-Place Replacement)` : `Parent ID: ${sourceOriginalCard?.id} → Custom Clone`)
                      : `ID: ${editingCard.id}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingCard(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Original Card Save Mode Selector */}
            {isBranchingOriginal && (
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                  <span>How would you like to save this card?</span>
                  <span className="text-[10px] font-mono text-amber-400">Original Card Customization</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveOriginalMode('overwrite')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      saveOriginalMode === 'overwrite'
                        ? 'bg-amber-500/15 border-amber-500/70 text-amber-200 ring-1 ring-amber-500/50'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      <Check className="w-3.5 h-3.5 text-amber-400" />
                      <span>Replace Original in Place</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Directly modifies this original card. Decks and game battles will use your custom stats without needing a duplicate copy.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaveOriginalMode('branch')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      saveOriginalMode === 'branch'
                        ? 'bg-cyan-500/15 border-cyan-500/70 text-cyan-200 ring-1 ring-cyan-500/50'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Branch as New Card Copy</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Keeps the original card intact in the pool and generates a separate new custom card version.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Layout: Left preview, Right form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card Preview */}
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-mono text-zinc-400 mb-2 uppercase tracking-wider">Live Preview</span>
                <div className={`w-56 rounded-2xl border-2 p-4 flex flex-col justify-between shadow-2xl bg-zinc-950 ${
                  editingCard.type === 'Operative' ? 'border-amber-500/60 shadow-amber-500/10' :
                  editingCard.type === 'Location' ? 'border-emerald-500/60 shadow-emerald-500/10' :
                  editingCard.type === 'Affiliation' ? 'border-rose-500/60 shadow-rose-500/10' :
                  'border-cyan-500/60 shadow-cyan-500/10'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 uppercase">
                        {editingCard.type}
                      </span>
                      {editingCard.cost > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-xs font-extrabold flex items-center gap-0.5">
                          <Coins className="w-3 h-3" />
                          {editingCard.cost}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-white leading-tight mb-2">
                      {editingCard.name || 'Untitled Card'}
                    </h4>

                    {editingCard.type === 'Operative' && (
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        <div className="bg-zinc-900 rounded p-1 text-center border border-zinc-800">
                          <div className="text-[9px] text-zinc-400">OFFENSE</div>
                          <div className="font-bold text-xs text-rose-400">{editingCard.off ?? 1}</div>
                        </div>
                        <div className="bg-zinc-900 rounded p-1 text-center border border-zinc-800">
                          <div className="text-[9px] text-zinc-400">DEFENSE</div>
                          <div className="font-bold text-xs text-blue-400">{editingCard.def ?? 1}</div>
                        </div>
                      </div>
                    )}

                    {(editingCard.type === 'Location' || editingCard.type === 'Affiliation') && (
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        <div className="bg-zinc-900 rounded p-1 text-center border border-zinc-800">
                          <div className="text-[9px] text-zinc-400">PROD</div>
                          <div className="font-bold text-xs text-emerald-400">+{editingCard.production ?? 1}</div>
                        </div>
                        <div className="bg-zinc-900 rounded p-1 text-center border border-zinc-800">
                          <div className="text-[9px] text-zinc-400">CAPACITY</div>
                          <div className="font-bold text-xs text-amber-400">{editingCard.cap ?? 1}</div>
                        </div>
                      </div>
                    )}

                    {editingCard.type === 'Operative' && (
                      <div className="flex items-center justify-around bg-zinc-900/80 rounded py-1 px-1.5 mb-2 text-[10px] font-mono border border-zinc-800/80">
                        <span className="text-rose-300">ASS: {editingCard.ass ?? 0}</span>
                        <span className="text-amber-300">RAID: {editingCard.raid ?? 0}</span>
                        <span className="text-purple-300">SUB: {editingCard.sub ?? 0}</span>
                      </div>
                    )}

                    <div className="bg-zinc-900/90 rounded-lg p-2 border border-zinc-800 min-h-[70px] text-[11px] text-zinc-300 leading-relaxed">
                      {editingCard.abilityText || 'Ability rules text...'}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                    <span>{editingCard.isNamed ? '★ UNIQUE' : 'COMMON'}</span>
                    <span>QTY: {editingCard.qty || 1}</span>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="md:col-span-2 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Card Name */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Card Name</label>
                    <input
                      type="text"
                      value={editingCard.name}
                      onChange={e => setEditingCard({ ...editingCard, name: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Card Type */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Card Type</label>
                    <select
                      value={editingCard.type}
                      onChange={e => {
                        const newType = e.target.value as CardType;
                        setEditingCard({
                          ...editingCard,
                          type: newType,
                          cost: (newType === 'Affiliation' || newType === 'Mission') ? 0 : editingCard.cost,
                          off: newType === 'Operative' ? (editingCard.off ?? 2) : undefined,
                          def: newType === 'Operative' ? (editingCard.def ?? 2) : undefined,
                          production: (newType === 'Location' || newType === 'Affiliation') ? (editingCard.production ?? 0) : undefined,
                          cap: (newType === 'Location' || newType === 'Affiliation') ? (editingCard.cap ?? 0) : undefined,
                          points: newType === 'Mission' ? (editingCard.points ?? 1) : undefined,
                          req: newType === 'Mission' ? (editingCard.req ?? 1) : undefined,
                          missionType: newType === 'Mission' ? (editingCard.missionType ?? 'kills') : undefined,
                        });
                      }}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Operative">Operative</option>
                      <option value="Location">Location</option>
                      <option value="Support">Support</option>
                      <option value="Affiliation">Affiliation</option>
                      <option value="Mission">Mission</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Cost */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Coin Cost</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={editingCard.cost}
                      disabled={editingCard.type === 'Affiliation' || editingCard.type === 'Mission'}
                      onChange={e => setEditingCard({ ...editingCard, cost: parseInt(e.target.value) || 0 })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Copies in Deck */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Default Copies</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editingCard.qty || 1}
                      onChange={e => setEditingCard({ ...editingCard, qty: parseInt(e.target.value) || 1 })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Is Named */}
                  {editingCard.type === 'Operative' && (
                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="isNamedCheck"
                        checked={!!editingCard.isNamed}
                        onChange={e => setEditingCard({ ...editingCard, isNamed: e.target.checked })}
                        className="rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-0"
                      />
                      <label htmlFor="isNamedCheck" className="text-xs text-zinc-300 cursor-pointer">
                        Unique Character
                      </label>
                    </div>
                  )}
                </div>

                {/* Operative Combat Stats */}
                {editingCard.type === 'Operative' && (
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2.5">
                    <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">
                      Operative Combat &amp; Skills
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Offense</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingCard.off ?? 1}
                          onChange={e => setEditingCard({ ...editingCard, off: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Defense</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingCard.def ?? 1}
                          onChange={e => setEditingCard({ ...editingCard, def: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Assassin</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingCard.ass ?? 0}
                          onChange={e => setEditingCard({ ...editingCard, ass: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Raid</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingCard.raid ?? 0}
                          onChange={e => setEditingCard({ ...editingCard, raid: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Subterfuge</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingCard.sub ?? 0}
                          onChange={e => setEditingCard({ ...editingCard, sub: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Location / Affiliation Economics */}
                {(editingCard.type === 'Location' || editingCard.type === 'Affiliation') && (
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2.5">
                    <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">
                      Economic Generation &amp; Capacity
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Production (coins/turn)</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingCard.production ?? 0}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setEditingCard({ ...editingCard, production: isNaN(val) ? 0 : Math.max(0, val) });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Coin Storage Capacity</label>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={editingCard.cap ?? 0}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            setEditingCard({ ...editingCard, cap: isNaN(val) ? 0 : Math.max(0, val) });
                          }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mission Objectives & Victory Points */}
                {editingCard.type === 'Mission' && (
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-purple-500/30 space-y-2.5">
                    <span className="text-[11px] font-mono text-purple-400 uppercase font-semibold">
                      Mission Objective &amp; Victory Points
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Victory Points</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={editingCard.points ?? 1}
                          onChange={e => setEditingCard({ ...editingCard, points: parseInt(e.target.value) || 1 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Target Count (Req)</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={editingCard.req ?? 1}
                          onChange={e => setEditingCard({ ...editingCard, req: parseInt(e.target.value) || 1 })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Trigger Condition</label>
                        <select
                          value={editingCard.missionType ?? 'kills'}
                          onChange={e => setEditingCard({ ...editingCard, missionType: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        >
                          <option value="kills">Operative Kills</option>
                          <option value="thwart_ass">Assassinations Thwarted</option>
                          <option value="thwart_raid">Raids Thwarted</option>
                          <option value="thwart_sub">Subterfuges Thwarted</option>
                          <option value="res_theft">Coins Siphoned</option>
                          <option value="hand_wipe">Hand Wiped</option>
                          <option value="three_distinct_ops">3 Distinct Ops In 1 Turn</option>
                          <option value="high_resource">High Resource Pool (8+ coins)</option>
                          <option value="all_types_in_play">Op, Loc &amp; Affiliation in Play</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rules & Ability Text */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Card Ability / Rules Text
                  </label>
                  <textarea
                    rows={3}
                    value={editingCard.abilityText || ''}
                    onChange={e => setEditingCard({ ...editingCard, abilityText: e.target.value })}
                    placeholder="Describe how the card functions during play..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>

                {/* Special Ability Engine Preset */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Special Ability Engine Integration
                  </label>
                  <select
                    value={editingCard.specialAbility || 'none'}
                    onChange={e => setEditingCard({
                      ...editingCard,
                      specialAbility: e.target.value === 'none' ? undefined : e.target.value
                    })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="none">None (Standard Combat / Passive Card)</option>
                    <optgroup label="Affiliation Abilities">
                      <option value="buff_skill">MI6: Tap to grant an operative +1 Raid, Assassin, or Subterfuge</option>
                      <option value="draw">Impossible Mission Force: Tap to Draw 1 card</option>
                      <option value="spawn_token">Shadow Home: Tap to Spawn 1/1 Shadow Warrior token</option>
                      <option value="play_operative">MK Entertainment: Passive (Operatives cost 1 fewer coin)</option>
                    </optgroup>
                    <optgroup label="Location Abilities">
                      <option value="armory_buff">Armory: Tap to give operative +1 Offense or +1 Defense</option>
                      <option value="force_discard">Troll Farm: Tap to force opponent to discard 1 card</option>
                      <option value="draw_card">Research Facility: Tap to Draw 1 card</option>
                    </optgroup>
                    <optgroup label="Operative Abilities">
                      <option value="boksoon_discard_ass1">Boksoon Execution: Discard enemy operative with Assassin skill &gt;= 1</option>
                      <option value="mata_hari_steal_card">Mata Hari Charm: Steal random card from enemy hand</option>
                      <option value="ghost_siphon_2">Ghost Cyber-Siphon: Siphon 2 resources upon deploy and activation</option>
                      <option value="dan_weak_sacrifice">Dan Weak Sacrifice: Sacrifice to force discard hand or discard 2 in play</option>
                    </optgroup>
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Connects this card to the interactive turn action engine so its special ability activates in the action menu.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingCard(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCard}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                  isBranchingOriginal 
                    ? saveOriginalMode === 'overwrite'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20'
                    : isCreatingNew
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                }`}
              >
                {isBranchingOriginal ? (
                  saveOriginalMode === 'overwrite' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Replace Original Card</span>
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-4 h-4" />
                      <span>Save as Custom Card Branch</span>
                    </>
                  )
                ) : isCreatingNew ? (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create Custom Card</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deleted Originals Restoration Modal */}
      {showDeletedOriginalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Deleted Original Cards</h3>
                  <p className="text-xs text-zinc-400">
                    {deletedOriginals.length} original core card{deletedOriginals.length === 1 ? ' is' : 's are'} currently removed from your database
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeletedOriginalsModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              When you delete original cards, they are removed from the card pool and active decks so your modified versions take their place. You can restore any of them below at any time:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {deletedOriginals.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-950/60 rounded-xl border border-zinc-800">
                  No original cards are currently deleted.
                </div>
              ) : (
                deletedOriginals.map(card => (
                  <div
                    key={card.id}
                    className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                          card.type === 'Operative' ? 'bg-amber-500/10 text-amber-400' :
                          card.type === 'Location' ? 'bg-emerald-500/10 text-emerald-400' :
                          card.type === 'Affiliation' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-cyan-500/10 text-cyan-400'
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
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {card.type === 'Operative' 
                          ? `${card.off}/${card.def} • ${card.abilityText || 'Standard combat'}`
                          : card.abilityText || `Prod: +${card.production}`}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRestoreCard(card.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-500/30 text-xs font-semibold whitespace-nowrap transition-all"
                    >
                      <RotateCcw className="w-3 h-3 text-emerald-400" />
                      <span>Restore</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
              <button
                onClick={handleRestoreAllOriginals}
                disabled={deletedOriginals.length === 0}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Restore All ({deletedOriginals.length})</span>
              </button>

              <button
                onClick={() => setShowDeletedOriginalsModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
