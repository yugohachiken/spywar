import React, { useState, useMemo, useEffect } from 'react';
import { SpywarEngine } from './engine/SpywarEngine';
import { GameBoard } from './components/GameBoard';
import { AbilityTestLab } from './components/AbilityTestLab';
import { GodotCodeViewer } from './components/GodotCodeViewer';
import { BatchSimulator } from './components/BatchSimulator';
import { CardEditor } from './components/CardEditor';
import { DeckBuilder } from './components/DeckBuilder';
import { CardDatabaseService } from './services/cardDatabaseService';
import { AFFILIATION_CARDS, LOCATION_CARDS, OPERATIVE_CARDS, SUPPORT_CARDS, MASTER_MISSIONS } from './engine/cardManifest';
import { Shield, Swords, FileCode, BarChart3, BookOpen, Sparkles, Terminal, Activity, ZoomIn, Layers, Edit3, Lock, Unlock, KeyRound, X } from 'lucide-react';
import { CardZoomProvider } from './context/CardZoomContext';
import { ZoomedCardModal } from './components/ZoomedCardModal';
import { ErrorBoundary } from './components/ErrorBoundary';

const DEV_PASSCODE = (import.meta.env.VITE_DEV_PASSCODE as string) || 'spywar2026';
const IS_DEV_MODE_DISABLED = import.meta.env.VITE_DISABLE_DEV_MODE === 'true';

export default function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'deck' | 'editor' | 'testlab' | 'godot' | 'batch' | 'dossier'>('board');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Passcode modal state for protecting developer features in public deployments (Vercel, itch.io)
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [logoClickCount, setLogoClickCount] = useState(0);

  // Developer Mode state:
  // On public release, players can only access the "Play Match" tab.
  // Developer Mode can be unlocked by the developer using the secret passcode (default: spywar2026)
  // or URL query parameter ?dev=<passcode> (e.g. ?dev=spywar2026).
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    if (IS_DEV_MODE_DISABLED) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const devParam = params.get('dev') || params.get('admin');
      if (devParam && devParam === DEV_PASSCODE) {
        localStorage.setItem('spywar_dev_mode', 'true');
        return true;
      }
      return localStorage.getItem('spywar_dev_mode') === 'true';
    } catch {
      return false;
    }
  });

  const requestDevUnlock = () => {
    if (IS_DEV_MODE_DISABLED) return;
    if (isDevMode) {
      // Re-lock to public playtest view
      setIsDevMode(false);
      try {
        localStorage.removeItem('spywar_dev_mode');
      } catch {}
      setActiveTab('board');
    } else {
      setPasscodeInput('');
      setPasscodeError('');
      setShowPasscodeModal(true);
    }
  };

  const handleVerifyPasscode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passcodeInput.trim() === DEV_PASSCODE) {
      setIsDevMode(true);
      try {
        localStorage.setItem('spywar_dev_mode', 'true');
      } catch {}
      setShowPasscodeModal(false);
      setPasscodeInput('');
      setPasscodeError('');
    } else {
      setPasscodeError('Incorrect passcode. Access denied.');
    }
  };

  // If a user navigates to ?dev=true without the secret key, trigger passcode prompt
  useEffect(() => {
    if (IS_DEV_MODE_DISABLED || isDevMode) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('dev') === 'true' || params.get('admin') === 'true') {
        setShowPasscodeModal(true);
      }
    } catch {}
  }, [isDevMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        requestDevUnlock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevMode]);

  // When not in dev mode, force active tab to 'board'
  useEffect(() => {
    if (!isDevMode && activeTab !== 'board') {
      setActiveTab('board');
    }
  }, [isDevMode, activeTab]);

  // Initialize engine once with active deck configuration and saved game config,
  // restoring any ongoing match session so browser updates/refreshes never lose match state
  const engine = useMemo(() => {
    const cardDb = CardDatabaseService.getInstance();
    const savedConfig = cardDb.getGameConfig();
    const inst = new SpywarEngine(savedConfig);
    const deckData = cardDb.generateGameDeckForEngine();
    inst.setGameMode('human_vs_ai');

    try {
      const savedSession = localStorage.getItem('spywar_active_match_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed && typeof parsed.currentRound === 'number' && parsed.currentRound > 0 && !parsed.gameOver) {
          inst.loadSerializedState(parsed);
          return inst;
        }
      }
    } catch (e) {
      console.warn('Could not restore saved match session:', e);
    }

    inst.setupGame({
      ...deckData,
      deckName: cardDb.getActiveDeck().name
    });
    return inst;
  }, []);

  const handleRefresh = () => {
    if (engine.currentRound > 0 && !engine.gameOver) {
      try {
        localStorage.setItem('spywar_active_match_session', JSON.stringify(engine.getSerializedState()));
      } catch (e) {
        // storage fallback
      }
    }
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePlayWithCustomDeck = (customDeckPayload: {
    affiliationDeck: any[];
    drawDeck: any[];
    missions: any[];
    deckName: string;
  }) => {
    localStorage.removeItem('spywar_active_match_session');
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
            <button
              onClick={() => {
                setLogoClickCount(prev => {
                  const next = prev + 1;
                  if (next >= 5) {
                    requestDevUnlock();
                    return 0;
                  }
                  return next;
                });
              }}
              title={isDevMode ? "SPYWAR Engine Architect" : "SPYWAR"}
              className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-black font-black text-base shadow-md shadow-amber-500/20 tracking-tighter focus:outline-none cursor-pointer"
            >
              SW
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                  SPYWAR
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                    isDevMode 
                      ? 'bg-zinc-800 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                  }`}>
                    {isDevMode ? 'Engine Architect' : 'Playtest Edition'}
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-zinc-400">
                {isDevMode 
                  ? 'ISMCTS Headless Simulator, Custom Deck Architect & Godot 4.x Suite'
                  : 'Cold War Espionage & Tactical Operations Card Game'}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          {isDevMode ? (
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

              <button
                onClick={requestDevUnlock}
                title="Lock to Public Release mode (itch.io player view)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all text-xs"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono font-semibold">Lock Mode</span>
              </button>
            </nav>
          ) : (
            <nav className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-zinc-900 text-amber-400 border border-zinc-800/90 shadow-sm">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span>Play Match</span>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        <div style={{ display: activeTab === 'board' || !isDevMode ? 'block' : 'none' }}>
          <ErrorBoundary>
            <GameBoard 
              engine={engine} 
              onRefresh={handleRefresh} 
              onNavigateToDeckBuilder={isDevMode ? () => setActiveTab('deck') : undefined}
              onNavigateToCardEditor={isDevMode ? () => setActiveTab('editor') : undefined}
            />
          </ErrorBoundary>
        </div>

        {isDevMode && activeTab === 'deck' && (
          <DeckBuilder
            onPlayWithDeck={handlePlayWithCustomDeck}
            onNavigateToCardEditor={() => setActiveTab('editor')}
          />
        )}

        {isDevMode && activeTab === 'editor' && (
          <CardEditor
            onDeckOrCardUpdated={handleRefresh}
            onNavigateToDeckBuilder={() => setActiveTab('deck')}
          />
        )}

        {isDevMode && activeTab === 'testlab' && (
          <AbilityTestLab engine={engine} onRefresh={handleRefresh} />
        )}

        {isDevMode && activeTab === 'godot' && (
          <GodotCodeViewer />
        )}

        {isDevMode && activeTab === 'batch' && (
          <BatchSimulator />
        )}

        {isDevMode && activeTab === 'dossier' && (
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

      {/* Developer Passcode Authentication Modal (Protects dev features on Vercel / itch.io) */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button
              onClick={() => {
                setShowPasscodeModal(false);
                setPasscodeError('');
                setPasscodeInput('');
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Developer Access</h3>
                <p className="text-xs text-zinc-400 font-mono">Engine Architect Suite</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              Enter developer passcode to unlock the card editor, deck builder, test lab, and simulation suite.
            </p>

            <form onSubmit={handleVerifyPasscode} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="Enter passcode..."
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    if (passcodeError) setPasscodeError('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 font-mono tracking-wider"
                />
                {passcodeError && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
                    {passcodeError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasscodeModal(false);
                    setPasscodeError('');
                    setPasscodeInput('');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all shadow-md shadow-amber-500/20"
                >
                  Unlock Suite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </CardZoomProvider>
  );
}
