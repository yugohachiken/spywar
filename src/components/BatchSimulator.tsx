import React, { useState } from 'react';
import { SpywarEngine } from '../engine/SpywarEngine';
import { ISMCTSAgent } from '../engine/ISMCTSAgent';
import { BarChart3, Play, Download, CheckCircle2, RotateCw } from 'lucide-react';

export const BatchSimulator: React.FC = () => {
  const [iterations, setIterations] = useState<number>(100);
  const [running, setRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<{
    totalGames: number;
    p1Wins: number;
    p2Wins: number;
    ties: number;
    affWins: Record<string, number>;
    affGames: Record<string, number>;
    missionClaims: Record<string, number>;
    avgCoinsDiscarded: number;
  } | null>(null);

  const runBatchSimulation = async () => {
    setRunning(true);
    setProgress(0);

    const stats = {
      totalGames: iterations,
      p1Wins: 0,
      p2Wins: 0,
      ties: 0,
      affWins: {} as Record<string, number>,
      affGames: {} as Record<string, number>,
      missionClaims: {} as Record<string, number>,
      avgCoinsDiscarded: 0
    };

    let totalDiscardedCoins = 0;
    const agent = new ISMCTSAgent(20); // Faster iteration depth for batch runs

    const batchChunk = 10;
    for (let i = 0; i < iterations; i += batchChunk) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Yield to UI
      const currentBatchEnd = Math.min(iterations, i + batchChunk);

      for (let g = i; g < currentBatchEnd; g++) {
        const engine = new SpywarEngine({ rounds: 5, cardsDrawnPerTurn: 2 });
        engine.setupGame();

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

        // Tally results
        if (engine.winner) {
          if (engine.winner.pid === 'P1') stats.p1Wins++;
          else stats.p2Wins++;

          const winAff = engine.winner.affiliation?.name || 'Unknown';
          stats.affWins[winAff] = (stats.affWins[winAff] || 0) + 1;
        } else {
          stats.ties++;
        }

        // Tally mission claims
        for (const p of engine.players) {
          for (const m of p.completed_missions) {
            stats.missionClaims[m.name] = (stats.missionClaims[m.name] || 0) + 1;
          }
        }
      }

      setProgress(Math.round((currentBatchEnd / iterations) * 100));
    }

    stats.avgCoinsDiscarded = totalDiscardedCoins / iterations;
    setResults(stats);
    setRunning(false);
  };

  const exportCSV = () => {
    if (!results) return;
    let csv = "Metric,Value\n";
    csv += `Total Games,${results.totalGames}\n`;
    csv += `P1 Initiative Wins,${results.p1Wins} (${((results.p1Wins / results.totalGames) * 100).toFixed(1)}%)\n`;
    csv += `P2 Wins,${results.p2Wins} (${((results.p2Wins / results.totalGames) * 100).toFixed(1)}%)\n`;
    csv += `Ties,${results.ties}\n\n`;

    csv += "Affiliation,Games,Wins,Win Rate (%)\n";
    for (const aff of Object.keys(results.affGames)) {
      const g = results.affGames[aff];
      const w = results.affWins[aff] || 0;
      csv += `"${aff}",${g},${w},${((w / g) * 100).toFixed(1)}\n`;
    }

    csv += "\nMission,Times Claimed\n";
    for (const m of Object.keys(results.missionClaims)) {
      csv += `"${m}",${results.missionClaims[m]}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spywar_batch_results_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Monte Carlo Automated Batch Balancer
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Simulates automated headless ISMCTS games to test balance across Affiliations, First-Player Initiative advantage, and Mission claim velocity.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <button
            onClick={runBatchSimulation}
            disabled={running}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              running
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
            }`}
          >
            {running ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? `Simulating (${progress}%)...` : 'Run Batch'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {running && (
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-300">
            <span>Executing headless ISMCTS rollouts...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-zinc-300 font-mono">
              Batch Telemetry ({results.totalGames} games completed)
            </h4>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            >
              <Download className="w-3 h-3" />
              Export Telemetry (.CSV)
            </button>
          </div>

          {/* Core Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-zinc-400">P1 Initiative Win Rate:</div>
              <div className="text-lg font-bold text-blue-400 mt-1">
                {((results.p1Wins / results.totalGames) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{results.p1Wins} / {results.totalGames} wins</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-zinc-400">P2 Win Rate:</div>
              <div className="text-lg font-bold text-rose-400 mt-1">
                {((results.p2Wins / results.totalGames) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{results.p2Wins} / {results.totalGames} wins</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <div className="text-zinc-400">Ties / Draws:</div>
              <div className="text-lg font-bold text-zinc-300 mt-1">
                {results.ties}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">{((results.ties / results.totalGames) * 100).toFixed(1)}% of matches</div>
            </div>
          </div>

          {/* Affiliation Breakdown Table */}
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="text-xs font-semibold text-zinc-200">Affiliation Win Rate Breakdown:</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-1.5 px-2">Affiliation</th>
                    <th className="py-1.5 px-2">Matches</th>
                    <th className="py-1.5 px-2">Victories</th>
                    <th className="py-1.5 px-2">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {Object.keys(results.affGames).map(aff => {
                    const games = results.affGames[aff];
                    const wins = results.affWins[aff] || 0;
                    const pct = games > 0 ? ((wins / games) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={aff} className="hover:bg-zinc-800/30">
                        <td className="py-1.5 px-2 text-zinc-200 font-semibold">{aff}</td>
                        <td className="py-1.5 px-2 text-zinc-400">{games}</td>
                        <td className="py-1.5 px-2 text-emerald-400">{wins}</td>
                        <td className="py-1.5 px-2 font-bold text-zinc-100">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Most Claimed Missions */}
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="text-xs font-semibold text-zinc-200">Missions Claimed by Frequency:</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs font-mono">
              {(Object.entries(results.missionClaims) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([mName, count]) => (
                  <div key={mName} className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <div className="text-zinc-300 font-semibold truncate" title={mName}>{mName}</div>
                    <div className="text-amber-400 font-bold text-sm mt-0.5">{count} claims</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
