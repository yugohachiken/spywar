import React, { useState } from 'react';
import { GODOT_SCRIPTS, GodotScriptFile } from '../engine/godotScripts';
import { Copy, Check, Download, FileCode, Server, Cpu, ShieldCheck } from 'lucide-react';

export const GodotCodeViewer: React.FC = () => {
  const [selectedScript, setSelectedScript] = useState<GodotScriptFile>(GODOT_SCRIPTS[3]); // Default SpywarEngine.gd
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedScript.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (script: GodotScriptFile) => {
    const blob = new Blob([script.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = script.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    GODOT_SCRIPTS.forEach(script => {
      handleDownloadFile(script);
    });
  };

  return (
    <div className="space-y-4">
      {/* Overview & Architecture Header */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            Godot 4.x Production GDScript Codebase
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Complete, decoupled Godot 4 architecture for SPYWAR: Authoritative game rules engine, Information Set MCTS AI agent, physical mission token manager, and server multiplayer networking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download All .gd Files
          </button>
        </div>
      </div>

      {/* Script Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {GODOT_SCRIPTS.map(script => (
          <button
            key={script.filename}
            onClick={() => setSelectedScript(script)}
            className={`p-2.5 rounded-lg text-left border transition-all ${
              selectedScript.filename === script.filename
                ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-200 shadow-sm shadow-cyan-500/10'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <div className="font-mono text-xs font-bold truncate">{script.filename}</div>
            <div className="text-[10px] text-zinc-500 truncate mt-0.5">{script.category}</div>
          </button>
        ))}
      </div>

      {/* Code Display Window */}
      <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-200 font-semibold">{selectedScript.filename}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              {selectedScript.category}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadFile(selectedScript)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
              title="Download file"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        <div className="p-3 bg-zinc-900/30 border-b border-zinc-800/60 text-xs text-zinc-400 font-sans">
          {selectedScript.description}
        </div>

        <div className="max-h-[520px] overflow-y-auto p-4 font-mono text-xs text-zinc-300 bg-black/50 leading-relaxed select-text">
          <pre>
            <code>{selectedScript.code}</code>
          </pre>
        </div>
      </div>

      {/* Godot Integration & Monetization Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold">
            <Server className="w-4 h-4" />
            1. Authoritative Online Server
          </div>
          <p className="text-zinc-400 leading-relaxed">
            The engine is decoupled from rendering. The host server holds the authoritative <code className="text-zinc-300">SpywarEngine</code>, validates action requests via RPCs, and broadcasts sanitized state updates with masked hidden opponent hands.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <Cpu className="w-4 h-4" />
            2. ISMCTS AI Opponent
          </div>
          <p className="text-zinc-400 leading-relaxed">
            <code className="text-zinc-300">ISMCTSAgent.gd</code> handles single-player games and seamless multiplayer bot fallbacks when an online opponent disconnects, preserving competitive integrity.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            3. Monetization Strategy
          </div>
          <p className="text-zinc-400 leading-relaxed">
            Built-in cosmetic slots for Card Backs, 3D Foil Shaders, Unique Named Operative alternative art skins (e.g. Cyberpunk Dan Weak, Neon Boksoon), and battle pass progression token effects.
          </p>
        </div>
      </div>
    </div>
  );
};
