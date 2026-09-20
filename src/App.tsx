import React, { useState, useMemo } from 'react';
import { SpywarEngine } from './engine/SpywarEngine';
import { GameBoard } from './components/GameBoard';
import { AbilityTestLab } from './components/AbilityTestLab';
import { GodotCodeViewer } from './components/GodotCodeViewer';
import { BatchSimulator } from './components/BatchSimulator';
import { CardEditor } from './components/CardEditor';
import { DeckBuilder } from './components/DeckBuilder';
import { CardDatabaseService } from './services/cardDatabaseService';
import { AFFILIATION_CARDS, LOCATION_CARDS, OPERATIVE_CARDS, SUPPORT_CARDS, MASTER_MISSIONS } from './engine/cardManifest';
import { Shield, Swords, FileCode, BarChart3, BookOpen, Sparkles, Terminal, Activity, ZoomIn, Layers, Edit3 } from 'lucide-react';
import { CardZoomProvider } from './context/CardZoomContext';
import { ZoomedCardModal } from './components/ZoomedCardModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'deck' | 'editor' | 'testlab' | 'godot' | 'batch' | 'dossier'>('board');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Initialize engine once with active deck configuration and saved game config
  const engine = useMemo(() => {
    const cardDb = CardDatabaseService.getInstance();
    const savedConfig = cardDb.getGameConfig();
    const inst = new SpywarEngine(savedConfig);
    const deckData = cardDb.generateGameDeckForEngine();
    inst.setupGame({
      ...deckData,
      deckName: cardDb.getActiveDeck().name
    });
    return inst;
  }, []);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePlayWithCustomDeck = (customDeckPayload: {
    affiliationDeck: any[];
    drawDeck: any[];
    missions: any[];
    deckName: string;
  }) => {
    engine.setupGame(customDeckPayload);
    setActiveTab('board');
    handleRefresh();
  };

  return (
    <CardZoomProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
        {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-black font-black text-base shadow-md shadow-amber-500/20 tracking-tighter">
              SW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  SPYWAR
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-500/30">
                    Engine Architect
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-zinc-400">
                ISMCTS Headless Simulator, Custom Deck Architect &amp; Godot 4.x Suite
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex flex-wrap items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'board'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Play Match</span>
            </button>

            <button
              onClick={() => setActiveTab('deck')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'deck'
                  ? 'bg-zinc-800 text-cyan-300 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Deck Builder</span>
            </button>

            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'editor'
                  ? 'bg-zinc-800 text-amber-300 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Card Editor</span>
            </button>

            <button
              onClick={() => setActiveTab('testlab')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'testlab'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>Ability Test Lab</span>
            </button>

            <button
              onClick={() => setActiveTab('godot')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'godot'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Godot 4 GDScript</span>
            </button>

            <button
              onClick={() => setActiveTab('batch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'batch'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Batch Balancer</span>
            </button>

            <button
              onClick={() => setActiveTab('dossier')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'dossier'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dossier</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {activeTab === 'board' && (
          <GameBoard 
            engine={engine} 
            onRefresh={handleRefresh} 
            onNavigateToDeckBuilder={() => setActiveTab('deck')}
            onNavigateToCardEditor={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'deck' && (
          <DeckBuilder
            onPlayWithDeck={handlePlayWithCustomDeck}
            onNavigateToCardEditor={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'editor' && (
          <CardEditor
            onDeckOrCardUpdated={handleRefresh}
            onNavigateToDeckBuilder={() => setActiveTab('deck')}
          />
        )}

        {activeTab === 'testlab' && (
          <AbilityTestLab engine={engine} onRefresh={handleRefresh} />
        )}

        {activeTab === 'godot' && (
          <GodotCodeViewer />
        )}

        {activeTab === 'batch' && (
          <BatchSimulator />
        )}

        {activeTab === 'dossier' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                SPYWAR Master Rules &amp; Card Manifest Reference
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Complete manifest reference covering Affiliations, Locations, Operatives, Support Cards, and Table Missions with rulebook mechanics.
              </p>
            </div>

            {/* Affiliations */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-semibold uppercase text-amber-400 tracking-wider">
                Affiliations (Drafted at setup)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {AFFILIATION_CARDS.map(aff => (
                  <div key={aff.id} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-200">{aff.name}</span>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">+{aff.production}/turn</span>
                    </div>
                    <p className="text-xs text-zinc-400">{aff.abilityText}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Named Operatives Highlight */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-semibold uppercase text-rose-400 tracking-wider">
                Specialized Named Operatives (Implemented Mechanics)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-rose-900/40 space-y-1.5">
                  <div className="font-bold text-rose-300">Boksoon (Cost: 4)</div>
                  <div className="text-[11px] font-mono text-zinc-400">Off: 4 | Def: 3 | Assassin: 3</div>
                  <p className="text-zinc-400 text-[11px]">
                    Ability: Discard an enemy operative in play with Assassin skill &ge; 1.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/60 border border-purple-900/40 space-y-1.5">
                  <div className="font-bold text-purple-300">Mata Hari (Cost: 4)</div>
                  <div className="text-[11px] font-mono text-zinc-400">Off: 3 | Def: 3 | Subterfuge: 3</div>
                  <p className="text-zinc-400 text-[11px]">
                    Ability: Take a random card directly from target player's hand.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/60 border border-amber-900/40 space-y-1.5">
                  <div className="font-bold text-amber-300">Ghost (Cost: 4)</div>
                  <div className="text-[11px] font-mono text-zinc-400">Off: 3 | Def: 3 | Raid: 3</div>
                  <p className="text-zinc-400 text-[11px]">
                    Deployment / Activation: Siphons 2 resources from opponent into your floating pool.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-900/60 border border-red-900/40 space-y-1.5">
                  <div className="font-bold text-red-300">Dan Weak (Cost: 5)</div>
                  <div className="text-[11px] font-mono text-zinc-400">Off: 4 | Def: 4 | Ass: 2 | Sub: 2</div>
                  <p className="text-zinc-400 text-[11px]">
                    Sacrifice from play to either force target to discard hand OR discard 2 cards in play.
                  </p>
                </div>
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-semibold uppercase text-cyan-400 tracking-wider">
                Locations &amp; Active Tapping Abilities
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="font-bold text-cyan-300">Armory (Cost: 2)</div>
                  <p className="text-zinc-400 text-[11px]">Tap: Give an operative +1 Offense or +1 Defense for the turn.</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="font-bold text-cyan-300">Troll Farm (Cost: 2)</div>
                  <p className="text-zinc-400 text-[11px]">Tap: Force target player to discard a card.</p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <div className="font-bold text-cyan-300">Research Facility (Cost: 4)</div>
                  <p className="text-zinc-400 text-[11px]">Tap: Draw a card from the draw deck.</p>
                </div>
              </div>
            </div>

            {/* Missions */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-semibold uppercase text-emerald-400 tracking-wider">
                Table Missions (1 revealed face-up per round)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {MASTER_MISSIONS.map(m => (
                  <div key={m.id} className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-200">{m.name}</div>
                      <div className="text-[11px] text-zinc-400">{m.description}</div>
                    </div>
                    <div className="font-mono text-emerald-400 font-bold shrink-0 ml-2">
                      +{m.points} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer with Version Number and Accessibility Info */}
      <footer id="app-footer" className="border-t border-zinc-800/80 py-3.5 px-4 sm:px-6 text-xs text-zinc-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="font-semibold text-zinc-300">SPYWAR Card Game Simulator</span>
          <span>&bull;</span>
          <span className="hidden sm:inline">Godot 4.x Architecture</span>
          <span className="hidden sm:inline">&bull;</span>
          <span>ISMCTS AI &amp; Cloud Multiplayer</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-amber-400 text-[11px]">
            <ZoomIn className="w-3 h-3 text-amber-400" />
            <span>Hover card + <kbd className="px-1 py-0.2 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 font-bold text-[10px]">Space</kbd> to Zoom (3x/5x)</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700/80 text-amber-400 font-bold text-[11px] shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            v1.3.0
          </span>
          <span className="text-[10px] text-zinc-500">build 2026.09.19</span>
        </div>
      </footer>

      {/* Global Spacebar Card Zoom Modal */}
      <ZoomedCardModal />
    </div>
    </CardZoomProvider>
  );
}
