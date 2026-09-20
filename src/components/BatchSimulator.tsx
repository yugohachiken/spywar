import React, { useState, useMemo } from 'react';
import { SpywarEngine, EngineConfig } from '../engine/SpywarEngine';
import { ISMCTSAgent } from '../engine/ISMCTSAgent';
import { CardDatabaseService } from '../services/cardDatabaseService';
import { 
  BarChart3, 
  Play, 
  Download, 
  RotateCw, 
  SlidersHorizontal, 
  Shield, 
  Layers, 
  Search, 
  Award, 
  RefreshCw,
  Zap,
  Target,
  FileSpreadsheet
} from 'lucide-react';

export interface CardTelemetryDetail {
  name: string;
  type: string;
  drawn: number;
  played: number;
}

export interface MissionTelemetryDetail {
  name: string;
  points: number;
  count: number;
  wonByP1: number;
  wonByP2: number;
}

interface SimulationReport {
  totalGames: number;
  configUsed: EngineConfig;
  deckUsedName: string;
  p1Wins: number;
  p2Wins: number;
  ties: number;
  affWins: Record<string, number>;
  affGames: Record<string, number>;
  // Card Draw & Play Frequency Telemetry
  cardTypeDrawn: Record<string, number>; // Operative, Location, Support
  cardTypePlayed: Record<string, number>;
  totalCardsDrawn: number;
  totalCardsPlayed: number;
  cardDetails: Record<string, CardTelemetryDetail>;
  // Mission Won Frequency Telemetry
  totalMissionsWon: number;
  gamesWithMissionWon: number;
  missionsWonByP1: number;
  missionsWonByP2: number;
  missionDetails: Record<string, MissionTelemetryDetail>;
}

export const BatchSimulator: React.FC = () => {
  const cardDb = useMemo(() => CardDatabaseService.getInstance(), []);

  // Simulation parameters
  const [iterations, setIterations] = useState<number>(100);
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Active game settings applied
  const [simConfig, setSimConfig] = useState<EngineConfig>(() => cardDb.getGameConfig());
  const [activeDeckName, setActiveDeckName] = useState<string>(() => cardDb.getActiveDeck().name);

  // Card filter in results view
  const [cardSearchTerm, setCardSearchTerm] = useState<string>('');
  const [cardTypeFilter, setCardTypeFilter] = useState<'ALL' | 'Operative' | 'Location' | 'Support'>('ALL');

  // Results state
  const [results, setResults] = useState<SimulationReport | null>(null);

  // Sync with global storage settings
  const handleSyncSettings = () => {
    const latestConfig = cardDb.getGameConfig();
    const latestDeck = cardDb.getActiveDeck().name;
    setSimConfig(latestConfig);
    setActiveDeckName(latestDeck);
  };

  const runBatchSimulation = async () => {
    setRunning(true);
    setProgress(0);

    const activeConfigSnapshot = { ...simConfig };
    const currentDeckName = activeDeckName;

    const stats: SimulationReport = {
      totalGames: iterations,
      configUsed: activeConfigSnapshot,
      deckUsedName: currentDeckName,
      p1Wins: 0,
      p2Wins: 0,
      ties: 0,
      affWins: {},
      affGames: {},
      cardTypeDrawn: { Operative: 0, Location: 0, Support: 0 },
      cardTypePlayed: { Operative: 0, Location: 0, Support: 0 },
      totalCardsDrawn: 0,
      totalCardsPlayed: 0,
      cardDetails: {},
      totalMissionsWon: 0,
      gamesWithMissionWon: 0,
      missionsWonByP1: 0,
      missionsWonByP2: 0,
      missionDetails: {}
    };

    const agent = new ISMCTSAgent(20); // Balanced depth for headless Monte Carlo
    const batchChunk = 10;

    for (let i = 0; i < iterations; i += batchChunk) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Yield to UI thread
      const currentBatchEnd = Math.min(iterations, i + batchChunk);

      for (let g = i; g < currentBatchEnd; g++) {
        // Instantiate engine with the exact modified game settings
        const engine = new SpywarEngine(activeConfigSnapshot);
        
        // Generate deck payload from the active custom or preset deck
        const deckData = cardDb.generateGameDeckForEngine();
        engine.setupGame({
          ...deckData,
          deckName: currentDeckName
        });

        const p1Aff = engine.players[0].affiliation?.name || 'Unknown';
        const p2Aff = engine.players[1].affiliation?.name || 'Unknown';
        stats.affGames[p1Aff] = (stats.affGames[p1Aff] || 0) + 1;
        stats.affGames[p2Aff] = (stats.affGames[p2Aff] || 0) + 1;

        // Run full game loop
        while (!engine.gameOver) {
          const active = engine.getActivePlayer();
          const opp = engine.getOpponent();
          const bestAction = agent.getBestAction(engine, active, opp);
          engine.executeAction(active, opp, bestAction);
        }

        // Tally match winner
        if (engine.winner) {
          if (engine.winner.pid === 'P1') stats.p1Wins++;
          else stats.p2Wins++;

          const winAff = engine.winner.affiliation?.name || 'Unknown';
          stats.affWins[winAff] = (stats.affWins[winAff] || 0) + 1;
        } else {
          stats.ties++;
        }

        // Tally match telemetry: Card Draws
        for (const [type, count] of Object.entries(engine.matchTelemetry.cardsDrawn.byType)) {
          stats.cardTypeDrawn[type] = (stats.cardTypeDrawn[type] || 0) + count;
          stats.totalCardsDrawn += count;
        }
        for (const [cardKey, item] of Object.entries(engine.matchTelemetry.cardsDrawn.byCard)) {
          if (!stats.cardDetails[cardKey]) {
            stats.cardDetails[cardKey] = { name: item.name, type: item.type, drawn: 0, played: 0 };
          }
          stats.cardDetails[cardKey].drawn += item.count;
        }

        // Tally match telemetry: Card Plays
        for (const [type, count] of Object.entries(engine.matchTelemetry.cardsPlayed.byType)) {
          stats.cardTypePlayed[type] = (stats.cardTypePlayed[type] || 0) + count;
          stats.totalCardsPlayed += count;
        }
        for (const [cardKey, item] of Object.entries(engine.matchTelemetry.cardsPlayed.byCard)) {
          if (!stats.cardDetails[cardKey]) {
            stats.cardDetails[cardKey] = { name: item.name, type: item.type, drawn: 0, played: 0 };
          }
          stats.cardDetails[cardKey].played += item.count;
        }

        // Tally match telemetry: Missions Won
        let gameHasMissionWon = false;
        for (const [mName, mItem] of Object.entries(engine.matchTelemetry.missionsWon.byMission)) {
          if (mItem.count > 0) gameHasMissionWon = true;
          if (!stats.missionDetails[mName]) {
            stats.missionDetails[mName] = {
              name: mItem.name,
              points: mItem.points,
              count: 0,
              wonByP1: 0,
              wonByP2: 0
            };
          }
          stats.missionDetails[mName].count += mItem.count;
          stats.missionDetails[mName].wonByP1 += mItem.wonByP1;
          stats.missionDetails[mName].wonByP2 += mItem.wonByP2;
        }

        if (gameHasMissionWon) {
          stats.gamesWithMissionWon++;
        }
        stats.totalMissionsWon += engine.matchTelemetry.missionsWon.total;
        stats.missionsWonByP1 += engine.matchTelemetry.missionsWon.byPlayer.P1;
        stats.missionsWonByP2 += engine.matchTelemetry.missionsWon.byPlayer.P2;
      }

      setProgress(Math.round((currentBatchEnd / iterations) * 100));
    }

    setResults(stats);
    setRunning(false);
  };

  const exportCSV = () => {
    if (!results) return;
    const cfg = results.configUsed;

    let csv = "====================================================\n";
    csv += "SPYWAR BATCH BALANCER TELEMETRY REPORT\n";
    csv += `Timestamp,${new Date().toISOString()}\n`;
    csv += `Total Matches Simulated,${results.totalGames}\n`;
    csv += "====================================================\n\n";

    // Section 1: Game Settings Used
    csv += "=== GAME SETTINGS APPLIED ===\n";
    csv += "Setting Parameter,Value,Description\n";
    csv += `Rounds to Simulate,${cfg.rounds},Max number of rounds per game\n`;
    csv += `Cards Drawn Per Turn,${cfg.cardsDrawnPerTurn},Draw phase card volume\n`;
    csv += `Maximum Hand Size Limit,${cfg.maxHandSize},End of draw phase discard threshold\n`;
    csv += `Points to Win (Sudden Death),${cfg.pointsToWin === 0 ? "0 (Disabled / Play All Rounds)" : cfg.pointsToWin},Instant victory threshold\n`;
    csv += `Affiliation Coin Storage Cap,${cfg.affiliationMaxCap},Max coins stored on affiliation headquarters\n`;
    csv += `Operative Summon State,${cfg.operativeSummonState === 'R' ? "Ready (R)" : "Exhausted (E)"},Summoning sickness setting\n`;
    csv += `Location Summon State,${cfg.locationSummonState === 'R' ? "Ready (R)" : "Exhausted (E)"},Summoning sickness setting\n`;
    csv += `Starting Mission Cards,${cfg.startingMissionCards},Mission cards revealed at match start\n`;
    csv += `Max Missions In Play,${cfg.maxMissionsInPlay === 0 ? "0 (Unlimited)" : cfg.maxMissionsInPlay},Cap on active missions on table\n`;
    csv += `Initiative Rule,${
      cfg.initiativeRule === 'LOWEST_PROD' ? 'Lowest Affiliation Production' :
      cfg.initiativeRule === 'RANDOM' ? 'Random Initiative (50/50)' : 'Highest Affiliation Production (Default)'
    },Rule for deciding first player (P1)\n`;
    csv += `Active Deck Preset,${results.deckUsedName},Source deck used for draw pool\n\n`;

    // Section 2: Match Outcomes
    csv += "=== MATCH OUTCOMES & INITIATIVE BALANCE ===\n";
    csv += "Outcome,Matches,Share (%)\n";
    csv += `Player 1 (Initiative) Wins,${results.p1Wins},${((results.p1Wins / results.totalGames) * 100).toFixed(1)}%\n`;
    csv += `Player 2 Wins,${results.p2Wins},${((results.p2Wins / results.totalGames) * 100).toFixed(1)}%\n`;
    csv += `Ties / Draws,${results.ties},${((results.ties / results.totalGames) * 100).toFixed(1)}%\n\n`;

    // Section 3: Affiliation Performance
    csv += "=== AFFILIATION PERFORMANCE ===\n";
    csv += "Affiliation,Matches,Victories,Win Rate (%)\n";
    for (const aff of Object.keys(results.affGames)) {
      const g = results.affGames[aff];
      const w = results.affWins[aff] || 0;
      csv += `"${aff}",${g},${w},${((w / g) * 100).toFixed(1)}%\n`;
    }
    csv += "\n";

    // Section 4: Card Type Frequency (Drawn vs Put into Play)
    csv += "=== CARD TYPE FREQUENCY (DRAWN VS PUT INTO PLAY) ===\n";
    csv += "Card Type,Total Drawn,Avg Drawn/Game,% of All Draws,Total Put into Play,Avg Played/Game,% of All Plays,Play-to-Draw Rate (%)\n";
    for (const type of ['Operative', 'Location', 'Support']) {
      const drawn = results.cardTypeDrawn[type] || 0;
      const played = results.cardTypePlayed[type] || 0;
      const avgDrawn = (drawn / results.totalGames).toFixed(2);
      const avgPlayed = (played / results.totalGames).toFixed(2);
      const pctDrawn = results.totalCardsDrawn > 0 ? ((drawn / results.totalCardsDrawn) * 100).toFixed(1) : '0.0';
      const pctPlayed = results.totalCardsPlayed > 0 ? ((played / results.totalCardsPlayed) * 100).toFixed(1) : '0.0';
      const playRate = drawn > 0 ? ((played / drawn) * 100).toFixed(1) : '0.0';
      csv += `"${type}",${drawn},${avgDrawn},${pctDrawn}%,${played},${avgPlayed},${pctPlayed}%,${playRate}%\n`;
    }
    csv += "\n";

    // Section 5: Individual Card Draw & Play Frequency
    csv += "=== INDIVIDUAL CARD TELEMETRY (ALL CARDS) ===\n";
    csv += "Card Name,Card Type,Times Drawn,Avg Drawn/Game,Times Put Into Play,Avg Played/Game,Play-to-Draw Rate (%)\n";
    const sortedCards: CardTelemetryDetail[] = Object.values(results.cardDetails);
    sortedCards.sort((a, b) => b.drawn - a.drawn);
    for (const c of sortedCards) {
      const avgD = (c.drawn / results.totalGames).toFixed(2);
      const avgP = (c.played / results.totalGames).toFixed(2);
      const rate = c.drawn > 0 ? ((c.played / c.drawn) * 100).toFixed(1) : '0.0';
      csv += `"${c.name}","${c.type}",${c.drawn},${avgD},${c.played},${avgP},${rate}%\n`;
    }
    csv += "\n";

    // Section 6: Mission Cards Won Frequency
    csv += "=== MISSION CARDS WON FREQUENCY ===\n";
    csv += `Total Mission Cards Won Across Batch,${results.totalMissionsWon}\n`;
    csv += `Average Missions Won Per Match,${(results.totalMissionsWon / results.totalGames).toFixed(2)}\n`;
    csv += `Matches With >= 1 Mission Won,${results.gamesWithMissionWon} (${((results.gamesWithMissionWon / results.totalGames) * 100).toFixed(1)}%)\n`;
    csv += `Missions Won by Player 1,${results.missionsWonByP1} (${results.totalMissionsWon > 0 ? ((results.missionsWonByP1 / results.totalMissionsWon) * 100).toFixed(1) : '0.0'}%)\n`;
    csv += `Missions Won by Player 2,${results.missionsWonByP2} (${results.totalMissionsWon > 0 ? ((results.missionsWonByP2 / results.totalMissionsWon) * 100).toFixed(1) : '0.0'}%)\n\n`;

    csv += "Mission Name,Points,Total Times Won,Game Win Frequency (%),Won by P1,Won by P2,P1 Win Share (%)\n";
    const sortedMissions: MissionTelemetryDetail[] = Object.values(results.missionDetails);
    sortedMissions.sort((a, b) => b.count - a.count);
    for (const m of sortedMissions) {
      const winFreq = ((m.count / results.totalGames) * 100).toFixed(1);
      const p1Share = m.count > 0 ? ((m.wonByP1 / m.count) * 100).toFixed(1) : '0.0';
      csv += `"${m.name}",${m.points},${m.count},${winFreq}%,${m.wonByP1},${m.wonByP2},${p1Share}%\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spywar_balancer_report_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered card list for results view
  const filteredCardDetails = useMemo(() => {
    if (!results) return [];
    const list: CardTelemetryDetail[] = Object.values(results.cardDetails);
    return list.filter(c => {
      if (cardTypeFilter !== 'ALL' && c.type !== cardTypeFilter) return false;
      if (cardSearchTerm && !c.name.toLowerCase().includes(cardSearchTerm.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.drawn - a.drawn);
  }, [results, cardTypeFilter, cardSearchTerm]);

  return (
    <div className="space-y-4">
      {/* Header & Controls Bar */}
      <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-zinc-100 text-sm sm:text-base">
              Automated ISMCTS Batch Balancer
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Settings Aware
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Simulates headless games using the active deck and modified game rules. Tracks card draw rates, battlefield deployment frequencies, and mission victory velocities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              showConfigPanel 
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
                : 'bg-zinc-800/90 hover:bg-zinc-700/90 border-zinc-700 text-zinc-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulation Settings</span>
          </button>

          {/* Iteration Selector */}
          <select
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            disabled={running}
            className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono"
          >
            <option value={50}>50 Matches</option>
            <option value={100}>100 Matches</option>
            <option value={250}>250 Matches</option>
            <option value={500}>500 Matches</option>
          </select>

          {/* Run Button */}
          <button
            onClick={runBatchSimulation}
            disabled={running}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              running
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
            }`}
          >
            {running ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {running ? `Simulating (${progress}%)...` : 'Run Batch Simulation'}
          </button>
        </div>
      </div>

      {/* Interactive Simulation Settings Drawer */}
      {showConfigPanel && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-zinc-100 font-mono uppercase tracking-wide">
                Active Game Settings for Batch Simulation
              </span>
            </div>
            <button
              onClick={handleSyncSettings}
              className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-amber-400 transition-colors"
              title="Reload settings from storage"
            >
              <RefreshCw className="w-3 h-3" />
              Sync from Match Rules
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs font-mono">
            {/* 1. Rounds */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">1. Rounds</span>
              <input
                type="number"
                min={1}
                max={10}
                value={simConfig.rounds}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 5));
                  const updated = { ...simConfig, rounds: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 2. Cards Drawn */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">2. Draw / Turn</span>
              <input
                type="number"
                min={1}
                max={5}
                value={simConfig.cardsDrawnPerTurn}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(5, parseInt(e.target.value) || 2));
                  const updated = { ...simConfig, cardsDrawnPerTurn: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 3. Hand Size Limit */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">3. Hand Limit</span>
              <input
                type="number"
                min={1}
                max={10}
                value={simConfig.maxHandSize}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 5));
                  const updated = { ...simConfig, maxHandSize: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 4. Points to Win */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">4. Points to Win</span>
              <input
                type="number"
                min={0}
                max={25}
                value={simConfig.pointsToWin}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  const updated = { ...simConfig, pointsToWin: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 5. Affiliation Cap */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">5. Affiliation Cap</span>
              <input
                type="number"
                min={1}
                max={20}
                value={simConfig.affiliationMaxCap}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 5));
                  const updated = { ...simConfig, affiliationMaxCap: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 6. Operative Summon */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">6. Op Summon</span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => {
                    const updated = { ...simConfig, operativeSummonState: 'R' as const };
                    setSimConfig(updated);
                    cardDb.saveGameConfig(updated);
                  }}
                  className={`flex-1 py-0.5 rounded text-center text-[10px] font-bold ${
                    simConfig.operativeSummonState === 'R' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  R
                </button>
                <button
                  onClick={() => {
                    const updated = { ...simConfig, operativeSummonState: 'E' as const };
                    setSimConfig(updated);
                    cardDb.saveGameConfig(updated);
                  }}
                  className={`flex-1 py-0.5 rounded text-center text-[10px] font-bold ${
                    simConfig.operativeSummonState === 'E' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  E
                </button>
              </div>
            </div>

            {/* 7. Location Summon */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">7. Loc Summon</span>
              <div className="flex items-center gap-1 mt-1">
                <button
                  onClick={() => {
                    const updated = { ...simConfig, locationSummonState: 'R' as const };
                    setSimConfig(updated);
                    cardDb.saveGameConfig(updated);
                  }}
                  className={`flex-1 py-0.5 rounded text-center text-[10px] font-bold ${
                    simConfig.locationSummonState === 'R' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  R
                </button>
                <button
                  onClick={() => {
                    const updated = { ...simConfig, locationSummonState: 'E' as const };
                    setSimConfig(updated);
                    cardDb.saveGameConfig(updated);
                  }}
                  className={`flex-1 py-0.5 rounded text-center text-[10px] font-bold ${
                    simConfig.locationSummonState === 'E' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  E
                </button>
              </div>
            </div>

            {/* 8. Starting Missions */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">8. Start Missions</span>
              <input
                type="number"
                min={1}
                max={10}
                value={simConfig.startingMissionCards}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                  const updated = { ...simConfig, startingMissionCards: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 9. Max Missions In Play */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">9. Max Missions</span>
              <input
                type="number"
                min={0}
                max={10}
                value={simConfig.maxMissionsInPlay}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                  const updated = { ...simConfig, maxMissionsInPlay: val };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-0.5 text-amber-400 font-bold text-center"
              />
            </div>

            {/* 10. Initiative Rule */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">10. Initiative</span>
              <select
                value={simConfig.initiativeRule || 'HIGHEST_PROD'}
                onChange={(e) => {
                  const updated = { ...simConfig, initiativeRule: e.target.value as any };
                  setSimConfig(updated);
                  cardDb.saveGameConfig(updated);
                }}
                className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 text-amber-400 font-bold text-[11px]"
              >
                <option value="HIGHEST_PROD">1. Highest Prod (Default)</option>
                <option value="LOWEST_PROD">2. Lowest Prod</option>
                <option value="RANDOM">3. Random (50/50)</option>
              </select>
            </div>

            {/* 11. Active Deck */}
            <div className="p-2 rounded bg-zinc-900/80 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 uppercase block">11. Deck Preset</span>
              <div className="mt-1 text-[11px] font-bold text-cyan-400 truncate" title={activeDeckName}>
                {activeDeckName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Progress Bar */}
      {running && (
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-indigo-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-200">
            <span className="flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              Running headless ISMCTS matches with custom parameters...
            </span>
            <span className="font-bold text-indigo-400">{progress}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-amber-500 h-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Report Display */}
      {results && (
        <div className="space-y-5">
          {/* Top Actions Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-zinc-100 font-mono flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Batch Balancer Telemetry Report ({results.totalGames} Matches)
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Simulated under: <span className="text-amber-400 font-mono">{results.deckUsedName}</span>
              </p>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Full Report (.CSV)
            </button>
          </div>

          {/* 1. REPORT OF GAME SETTINGS USED */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 font-mono">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>1. Game Settings &amp; Rules Applied to this Run:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Rounds</span>
                <span className="font-bold text-amber-400 text-sm">{results.configUsed.rounds}</span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Draw / Turn</span>
                <span className="font-bold text-amber-400 text-sm">{results.configUsed.cardsDrawnPerTurn} cards</span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Max Hand Size</span>
                <span className="font-bold text-amber-400 text-sm">{results.configUsed.maxHandSize} cards</span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Points to Win</span>
                <span className="font-bold text-amber-400 text-sm">
                  {results.configUsed.pointsToWin === 0 ? 'Full Rounds' : `${results.configUsed.pointsToWin} Pts`}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Affiliation Cap</span>
                <span className="font-bold text-amber-400 text-sm">{results.configUsed.affiliationMaxCap} coins</span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Op Summon State</span>
                <span className="font-bold text-amber-400 text-sm">
                  {results.configUsed.operativeSummonState === 'R' ? 'Ready (R)' : 'Exhausted (E)'}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Loc Summon State</span>
                <span className="font-bold text-amber-400 text-sm">
                  {results.configUsed.locationSummonState === 'R' ? 'Ready (R)' : 'Exhausted (E)'}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Starting Missions</span>
                <span className="font-bold text-amber-400 text-sm">{results.configUsed.startingMissionCards}</span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Max Missions</span>
                <span className="font-bold text-amber-400 text-sm">
                  {results.configUsed.maxMissionsInPlay === 0 ? 'Unlimited' : results.configUsed.maxMissionsInPlay}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Initiative Rule</span>
                <span className="font-bold text-amber-400 text-xs truncate block" title={
                  results.configUsed.initiativeRule === 'LOWEST_PROD' ? 'Lowest Production' :
                  results.configUsed.initiativeRule === 'RANDOM' ? 'Random Initiative (50/50)' : 'Highest Production (Default)'
                }>
                  {results.configUsed.initiativeRule === 'LOWEST_PROD' ? 'Lowest Prod' :
                   results.configUsed.initiativeRule === 'RANDOM' ? 'Random (50/50)' : 'Highest Prod'}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-500 uppercase block">Active Deck</span>
                <span className="font-bold text-cyan-400 text-xs truncate block" title={results.deckUsedName}>
                  {results.deckUsedName}
                </span>
              </div>
            </div>
          </div>

          {/* 2. MATCH OUTCOMES & INITIATIVE BALANCE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-zinc-400">P1 Initiative Win Rate:</div>
              <div className="text-xl font-black text-blue-400 mt-1">
                {((results.p1Wins / results.totalGames) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{results.p1Wins} / {results.totalGames} match victories</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-zinc-400">P2 Win Rate:</div>
              <div className="text-xl font-black text-rose-400 mt-1">
                {((results.p2Wins / results.totalGames) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{results.p2Wins} / {results.totalGames} match victories</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-zinc-400">Draws / Ties:</div>
              <div className="text-xl font-black text-zinc-300 mt-1">
                {results.ties}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{((results.ties / results.totalGames) * 100).toFixed(1)}% of matches</div>
            </div>
          </div>

          {/* 3. CARD FREQUENCY TELEMETRY: DRAWN VS PUT INTO PLAY */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
                  Card Frequency: Drawn vs. Put into Play
                </h5>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Total Draws: <span className="text-zinc-200 font-bold">{results.totalCardsDrawn}</span> | Total Plays: <span className="text-zinc-200 font-bold">{results.totalCardsPlayed}</span>
              </span>
            </div>

            {/* Aggregated by Card Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              {(['Operative', 'Location', 'Support'] as const).map(type => {
                const drawn = results.cardTypeDrawn[type] || 0;
                const played = results.cardTypePlayed[type] || 0;
                const avgDrawn = (drawn / results.totalGames).toFixed(1);
                const avgPlayed = (played / results.totalGames).toFixed(1);
                const playRate = drawn > 0 ? ((played / drawn) * 100).toFixed(1) : '0.0';
                const shareDrawn = results.totalCardsDrawn > 0 ? ((drawn / results.totalCardsDrawn) * 100).toFixed(1) : '0.0';

                const colorClass = 
                  type === 'Operative' ? 'text-amber-400' :
                  type === 'Location' ? 'text-emerald-400' : 'text-purple-400';

                const borderClass = 
                  type === 'Operative' ? 'border-amber-500/30' :
                  type === 'Location' ? 'border-emerald-500/30' : 'border-purple-500/30';

                return (
                  <div key={type} className={`p-3.5 rounded-lg bg-zinc-950/80 border ${borderClass} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold uppercase tracking-wider text-xs ${colorClass}`}>{type} Cards</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                        {playRate}% Play Rate
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800/80">
                      <div>
                        <span className="text-zinc-500 block">Drawn:</span>
                        <span className="text-zinc-200 font-bold text-sm">{drawn}</span>
                        <span className="text-zinc-500 block text-[10px]">{avgDrawn} / match ({shareDrawn}%)</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Put into Play:</span>
                        <span className="text-zinc-200 font-bold text-sm">{played}</span>
                        <span className="text-zinc-500 block text-[10px]">{avgPlayed} / match</span>
                      </div>
                    </div>

                    {/* Progress Bar of Conversion Rate */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Conversion to Play:</span>
                        <span className="font-bold text-zinc-200">{playRate}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full" 
                          style={{ width: `${Math.min(100, parseFloat(playRate))}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Individual Card Breakdown Table with Filter */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-xs font-semibold text-zinc-200 font-mono">
                  Detailed Card-by-Card Draw &amp; Play Velocity:
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Filter cards..."
                      value={cardSearchTerm}
                      onChange={(e) => setCardSearchTerm(e.target.value)}
                      className="pl-7 pr-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 w-36 focus:w-48 transition-all"
                    />
                  </div>

                  <div className="flex items-center bg-zinc-950 rounded border border-zinc-800 p-0.5 text-[11px] font-mono">
                    {(['ALL', 'Operative', 'Location', 'Support'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setCardTypeFilter(f)}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          cardTypeFilter === f ? 'bg-zinc-800 text-zinc-100 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {f === 'ALL' ? 'All' : f.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 border border-zinc-800/80 rounded-lg">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="py-2 px-3">Card Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3 text-right">Drawn (Avg/Game)</th>
                      <th className="py-2 px-3 text-right">Put Into Play (Avg)</th>
                      <th className="py-2 px-3 text-right">Play-to-Draw %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                    {filteredCardDetails.map(c => {
                      const avgD = (c.drawn / results.totalGames).toFixed(2);
                      const avgP = (c.played / results.totalGames).toFixed(2);
                      const rate = c.drawn > 0 ? ((c.played / c.drawn) * 100).toFixed(1) : '0.0';
                      const badgeColor = 
                        c.type === 'Operative' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        c.type === 'Location' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-purple-500/10 text-purple-400 border-purple-500/20';

                      return (
                        <tr key={c.name} className="hover:bg-zinc-800/30">
                          <td className="py-1.5 px-3 font-medium text-zinc-200">{c.name}</td>
                          <td className="py-1.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${badgeColor}`}>
                              {c.type}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right text-zinc-300">
                            {c.drawn} <span className="text-[10px] text-zinc-500">({avgD})</span>
                          </td>
                          <td className="py-1.5 px-3 text-right text-emerald-400 font-bold">
                            {c.played} <span className="text-[10px] text-zinc-500">({avgP})</span>
                          </td>
                          <td className="py-1.5 px-3 text-right text-zinc-100 font-bold">
                            {rate}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. MISSION CARDS WON FREQUENCY TELEMETRY */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
                  Mission Cards Won Frequency &amp; Victory Distribution
                </h5>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Total Claims: <span className="text-amber-400 font-bold">{results.totalMissionsWon}</span> | Matches with &ge;1 Claim: <span className="text-zinc-200 font-bold">{((results.gamesWithMissionWon / results.totalGames) * 100).toFixed(1)}%</span>
              </span>
            </div>

            {/* High-level Mission Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Total Won</span>
                <span className="font-bold text-amber-400 text-base">{results.totalMissionsWon}</span>
                <span className="text-[10px] text-zinc-500 block">{(results.totalMissionsWon / results.totalGames).toFixed(2)} / match</span>
              </div>

              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Games with Win</span>
                <span className="font-bold text-zinc-200 text-base">{results.gamesWithMissionWon} / {results.totalGames}</span>
                <span className="text-[10px] text-emerald-400 block">{((results.gamesWithMissionWon / results.totalGames) * 100).toFixed(1)}% of games</span>
              </div>

              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Won by P1 (Initiative)</span>
                <span className="font-bold text-blue-400 text-base">{results.missionsWonByP1}</span>
                <span className="text-[10px] text-zinc-500 block">
                  {results.totalMissionsWon > 0 ? ((results.missionsWonByP1 / results.totalMissionsWon) * 100).toFixed(1) : '0.0'}% share
                </span>
              </div>

              <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase block">Won by P2 (AI)</span>
                <span className="font-bold text-rose-400 text-base">{results.missionsWonByP2}</span>
                <span className="text-[10px] text-zinc-500 block">
                  {results.totalMissionsWon > 0 ? ((results.missionsWonByP2 / results.totalMissionsWon) * 100).toFixed(1) : '0.0'}% share
                </span>
              </div>
            </div>

            {/* Per-Mission Breakdown Table */}
            <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="py-2 px-3">Mission Card Name</th>
                    <th className="py-2 px-3">Value</th>
                    <th className="py-2 px-3 text-right">Total Won</th>
                    <th className="py-2 px-3 text-right">Game Frequency (%)</th>
                    <th className="py-2 px-3 text-right">Won by P1</th>
                    <th className="py-2 px-3 text-right">Won by P2</th>
                    <th className="py-2 px-3 text-right">P1 Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                  {(Object.values(results.missionDetails) as MissionTelemetryDetail[])
                    .sort((a, b) => b.count - a.count)
                    .map(m => {
                      const gameFreq = ((m.count / results.totalGames) * 100).toFixed(1);
                      const p1Share = m.count > 0 ? ((m.wonByP1 / m.count) * 100).toFixed(1) : '0.0';

                      return (
                        <tr key={m.name} className="hover:bg-zinc-800/30">
                          <td className="py-1.5 px-3 font-semibold text-zinc-200">{m.name}</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              +{m.points} pts
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-amber-400">{m.count}</td>
                          <td className="py-1.5 px-3 text-right text-zinc-100 font-bold">{gameFreq}%</td>
                          <td className="py-1.5 px-3 text-right text-blue-400">{m.wonByP1}</td>
                          <td className="py-1.5 px-3 text-right text-rose-400">{m.wonByP2}</td>
                          <td className="py-1.5 px-3 text-right text-zinc-400">{p1Share}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. AFFILIATION WIN RATE BREAKDOWN */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="text-xs font-semibold text-zinc-200 font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Affiliation Win Rate Breakdown:</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-1.5 px-3">Affiliation</th>
                    <th className="py-1.5 px-3">Matches</th>
                    <th className="py-1.5 px-3">Victories</th>
                    <th className="py-1.5 px-3">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {Object.keys(results.affGames).map(aff => {
                    const games = results.affGames[aff];
                    const wins = results.affWins[aff] || 0;
                    const pct = games > 0 ? ((wins / games) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={aff} className="hover:bg-zinc-800/30">
                        <td className="py-1.5 px-3 text-zinc-200 font-semibold">{aff}</td>
                        <td className="py-1.5 px-3 text-zinc-400">{games}</td>
                        <td className="py-1.5 px-3 text-emerald-400 font-bold">{wins}</td>
                        <td className="py-1.5 px-3 font-bold text-zinc-100">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
