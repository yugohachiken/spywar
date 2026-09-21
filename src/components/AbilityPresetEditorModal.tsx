import React, { useState } from 'react';
import { 
  AbilityPreset, 
  AbilityTrigger, 
  AbilityCategory, 
  AbilityPresetService, 
  BUILT_IN_ABILITY_PRESETS 
} from '../services/abilityPresetService';
import { 
  Zap, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  RotateCcw, 
  X, 
  Check, 
  Download, 
  Upload, 
  Shield, 
  Flame, 
  Search,
  Sparkles,
  Info
} from 'lucide-react';

interface AbilityPresetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (presetId: string) => void;
  selectedPresetId?: string;
}

export const AbilityPresetEditorModal: React.FC<AbilityPresetEditorModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  selectedPresetId
}) => {
  const presetService = AbilityPresetService.getInstance();
  const [presets, setPresets] = useState<AbilityPreset[]>(() => presetService.getAllPresets());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'All' | AbilityCategory>('All');
  
  // Editor State
  const [editingPreset, setEditingPreset] = useState<AbilityPreset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const refreshPresets = () => {
    setPresets(presetService.getAllPresets());
  };

  const handleCreateNew = () => {
    setEditingPreset({
      id: `custom_preset_${Date.now()}`,
      name: 'New Custom Ability',
      category: 'Universal',
      trigger: 'activated_tap',
      description: 'Tap card while in play to activate custom effect.',
      isBuiltIn: false,
      canPlayOnDefense: false,
      config: {
        offenseBuff: 0,
        defenseBuff: 0,
        discardHandCount: 0,
        discardFieldCount: 0,
        drawCount: 0,
        siphonCoins: 0,
      }
    });
    setIsCreatingNew(true);
  };

  const handleEdit = (preset: AbilityPreset) => {
    setEditingPreset({ ...preset, config: { ...preset.config } });
    setIsCreatingNew(false);
  };

  const handleDuplicate = (preset: AbilityPreset) => {
    setEditingPreset({
      ...preset,
      id: `${preset.id}_copy_${Date.now().toString().slice(-4)}`,
      name: `${preset.name} (Copy)`,
      isBuiltIn: false,
      config: { ...preset.config }
    });
    setIsCreatingNew(true);
  };

  const handleDelete = (id: string) => {
    presetService.deletePreset(id);
    refreshPresets();
    setStatusMessage('Preset deleted or reset to default.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSavePreset = () => {
    if (!editingPreset) return;
    if (!editingPreset.name.trim() || !editingPreset.id.trim()) {
      alert('Preset name and ID are required.');
      return;
    }

    const cleanedId = editingPreset.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const toSave: AbilityPreset = {
      ...editingPreset,
      id: cleanedId,
      canPlayOnDefense: editingPreset.canPlayOnDefense || editingPreset.trigger === 'reaction_defense',
      config: {
        ...editingPreset.config,
        canPlayOnDefense: editingPreset.canPlayOnDefense || editingPreset.trigger === 'reaction_defense',
      }
    };

    presetService.savePreset(toSave);
    refreshPresets();
    setEditingPreset(null);
    setIsCreatingNew(false);
    setStatusMessage(`Saved preset "${toSave.name}".`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportJson = () => {
    const jsonStr = presetService.exportPresetsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spywar-ability-presets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = presetService.importPresetsJson(content);
      if (res.success) {
        refreshPresets();
        setStatusMessage(`Successfully imported ${res.count} ability presets!`);
      } else {
        alert(`Import failed: ${res.error}`);
      }
      setTimeout(() => setStatusMessage(null), 3500);
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all presets to factory defaults? Any custom presets will be removed.')) {
      presetService.resetToDefaults();
      refreshPresets();
      setStatusMessage('All presets reset to factory defaults.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const filteredPresets = presets.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory || p.category === 'Universal';
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                Ability Presets Manager
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Engine Actions
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Configure special rules, tap effects, quick defensive reactions, and sacrifice actions executed by the game engine.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Ability Preset</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-all"
              title="Export all presets as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 cursor-pointer transition-all">
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-zinc-700 transition-all"
              title="Reset all presets to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
            <div className="relative flex-grow sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search presets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="All">All Categories</option>
              <option value="Operative">Operative</option>
              <option value="Location">Location</option>
              <option value="Affiliation">Affiliation</option>
              <option value="Support">Support</option>
              <option value="Universal">Universal</option>
            </select>
          </div>
        </div>

        {/* Presets Grid / List */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 max-h-[55vh]">
          {filteredPresets.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 bg-zinc-950/60 rounded-xl border border-zinc-800">
              No ability presets found matching your filter.
            </div>
          ) : (
            filteredPresets.map(preset => {
              const isSelected = selectedPresetId === preset.id;
              const isBuiltIn = BUILT_IN_ABILITY_PRESETS.some(b => b.id === preset.id);

              return (
                <div
                  key={preset.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/30'
                      : 'bg-zinc-950/70 border-zinc-800/90 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          preset.category === 'Operative' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          preset.category === 'Location' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          preset.category === 'Support' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                          preset.category === 'Affiliation' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {preset.category}
                        </span>

                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                          Trigger: {preset.trigger.replace('_', ' ').toUpperCase()}
                        </span>

                        {preset.canPlayOnDefense && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/60 flex items-center gap-0.5">
                            <Shield className="w-2.5 h-2.5 text-red-400" /> Defensive Reaction
                          </span>
                        )}

                        {isBuiltIn ? (
                          <span className="text-[9px] font-mono text-zinc-500">Core Preset</span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Custom Preset
                          </span>
                        )}

                        <h3 className="font-bold text-sm text-white">{preset.name}</h3>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {preset.description}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 pt-0.5">
                        <span>Engine ID: <strong className="text-zinc-400">{preset.id}</strong></span>
                        {preset.config?.offenseBuff ? <span>OFF: +{preset.config.offenseBuff}</span> : null}
                        {preset.config?.defenseBuff ? <span>DEF: +{preset.config.defenseBuff}</span> : null}
                        {preset.config?.discardHandCount ? <span>Hand Discard: {preset.config.discardHandCount}</span> : null}
                        {preset.config?.discardFieldCount ? <span>Field Discard: {preset.config.discardFieldCount}</span> : null}
                        {preset.config?.skillTokenOptions ? <span>Skills: {preset.config.skillTokenOptions.join('/').toUpperCase()}</span> : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onSelectPreset && (
                        <button
                          onClick={() => {
                            onSelectPreset(preset.id);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-amber-500 text-black shadow-md'
                              : 'bg-zinc-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Use Preset'}
                        </button>
                      )}

                      <button
                        onClick={() => handleEdit(preset)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all"
                        title="Edit preset parameters"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(preset)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all"
                        title="Duplicate as new preset"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(preset.id)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-all"
                        title={isBuiltIn ? "Reset parameters to default" : "Delete custom preset"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-500" />
            <span>Presets link card definitions with interactive actions in the turn engine.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20"
          >
            Done
          </button>
        </div>

        {/* Create / Edit Preset Sub-Modal */}
        {editingPreset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-auto">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-white">
                    {isCreatingNew ? 'Create New Ability Preset' : `Edit: ${editingPreset.name}`}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingPreset(null)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Preset Name
                  </label>
                  <input
                    type="text"
                    value={editingPreset.name}
                    onChange={e => setEditingPreset({ ...editingPreset, name: e.target.value })}
                    placeholder="e.g. Strike / Defense Team"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Internal Engine ID
                  </label>
                  <input
                    type="text"
                    value={editingPreset.id}
                    onChange={e => setEditingPreset({ ...editingPreset, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="e.g. assemble_strike_defense"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 focus:border-amber-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    This identifier binds cards to the engine execution pipeline.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Primary Category
                    </label>
                    <select
                      value={editingPreset.category}
                      onChange={e => setEditingPreset({ ...editingPreset, category: e.target.value as any })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="Operative">Operative</option>
                      <option value="Location">Location</option>
                      <option value="Support">Support</option>
                      <option value="Affiliation">Affiliation</option>
                      <option value="Universal">Universal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      Activation Trigger
                    </label>
                    <select
                      value={editingPreset.trigger}
                      onChange={e => setEditingPreset({ ...editingPreset, trigger: e.target.value as any })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="activated_tap">Tap while in play</option>
                      <option value="sacrifice">Sacrifice (Discard in play)</option>
                      <option value="reaction_defense">Quick Defensive Reaction</option>
                      <option value="on_play">On Play Modal</option>
                      <option value="passive">Passive Continuous</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">
                    Action Mechanics &amp; Modifiers
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">Offense Buff Token (+OFF)</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={editingPreset.config?.offenseBuff ?? 0}
                        onChange={e => setEditingPreset({
                          ...editingPreset,
                          config: { ...editingPreset.config, offenseBuff: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">Defense Buff Token (+DEF)</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={editingPreset.config?.defenseBuff ?? 0}
                        onChange={e => setEditingPreset({
                          ...editingPreset,
                          config: { ...editingPreset.config, defenseBuff: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">Force Hand Discard</label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={editingPreset.config?.discardHandCount ?? 0}
                        onChange={e => setEditingPreset({
                          ...editingPreset,
                          config: { ...editingPreset.config, discardHandCount: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-0.5">Force In-Play Discard</label>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={editingPreset.config?.discardFieldCount ?? 0}
                        onChange={e => setEditingPreset({
                          ...editingPreset,
                          config: { ...editingPreset.config, discardFieldCount: parseInt(e.target.value) || 0 }
                        })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPreset.canPlayOnDefense || editingPreset.trigger === 'reaction_defense'}
                      onChange={e => setEditingPreset({ ...editingPreset, canPlayOnDefense: e.target.checked })}
                      className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs text-zinc-200">
                      Can be cast out-of-turn when defending an attack (Reaction)
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Ability Description / Card Text
                  </label>
                  <textarea
                    rows={3}
                    value={editingPreset.description}
                    onChange={e => setEditingPreset({ ...editingPreset, description: e.target.value })}
                    placeholder="Describe how the card functions when this preset is triggered..."
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md shadow-amber-500/20"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
