import React, { useState, useMemo } from 'react';
import { 
  AbilityParserService, 
  AbilityTriggerType, 
  AbilityTargetType, 
  AtomicEffect, 
  ParsedAbilityDefinition 
} from '../services/abilityParserService';
import { 
  Zap, 
  Shield, 
  Flame, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Plus, 
  RotateCcw, 
  Coins, 
  Layers,
  HelpCircle,
  Copy,
  Crosshair
} from 'lucide-react';

interface AbilityRuleEditorProps {
  initialText: string;
  onUpdateText: (newText: string, parsed: ParsedAbilityDefinition) => void;
  cardType?: string;
}

export const AbilityRuleEditor: React.FC<AbilityRuleEditorProps> = ({
  initialText,
  onUpdateText,
  cardType = 'Operative'
}) => {
  const parser = AbilityParserService.getInstance();
  const [activeTab, setActiveTab] = useState<'visual' | 'syntax' | 'sandbox'>('syntax');
  const [text, setText] = useState<string>(initialText);

  // Visual Builder State
  const [builderTrigger, setBuilderTrigger] = useState<AbilityTriggerType>('tap');
  const [builderTarget, setBuilderTarget] = useState<AbilityTargetType>('friendly_op');
  const [builderEffectCategory, setBuilderEffectCategory] = useState<'buff' | 'skill' | 'draw' | 'siphon' | 'discard' | 'spawn' | 'defense'>('buff');
  const [statType, setStatType] = useState<'off' | 'def' | 'both_choice'>('both_choice');
  const [statAmount, setStatAmount] = useState<number>(1);
  const [skillTokenChoice, setSkillTokenChoice] = useState<'any' | 'ass' | 'raid' | 'sub'>('any');
  const [drawAmount, setDrawAmount] = useState<number>(1);
  const [siphonAmount, setSiphonAmount] = useState<number>(2);
  const [discardMode, setDiscardMode] = useState<'hand' | 'field' | 'choice'>('choice');
  const [discardHandCount, setDiscardHandCount] = useState<number>(1);
  const [discardFieldCount, setDiscardFieldCount] = useState<number>(2);
  const [tokenName, setTokenName] = useState<string>('Shadow Warrior');
  const [tokenOff, setTokenOff] = useState<number>(1);
  const [tokenDef, setTokenDef] = useState<number>(1);
  const [defenseBonus, setDefenseBonus] = useState<number>(2);
  const [costCoins, setCostCoins] = useState<number>(0);

  // Sandbox Test Simulation State
  const [sandboxLog, setSandboxLog] = useState<string[]>([]);
  const [sandboxOpBuff, setSandboxOpBuff] = useState<{ off: number; def: number; tokens: string[] }>({ off: 2, def: 2, tokens: [] });
  const [sandboxOpponentState, setSandboxOpponentState] = useState<{ hand: number; coins: number; inPlay: number }>({ hand: 4, coins: 5, inPlay: 3 });

  // Live parsed result
  const parsed = useMemo(() => {
    return parser.parseAbility(text);
  }, [text, parser]);

  const handleTextChange = (newVal: string) => {
    setText(newVal);
    const p = parser.parseAbility(newVal);
    onUpdateText(newVal, p);
  };

  const handleApplyBuilderToText = () => {
    const effects: AtomicEffect[] = [];

    if (builderEffectCategory === 'buff') {
      if (statType === 'both_choice') {
        effects.push({
          type: 'choice',
          choices: [
            { type: 'buff_stat', stat: 'off', amount: statAmount, rawPhrase: `+${statAmount} Offense` },
            { type: 'buff_stat', stat: 'def', amount: statAmount, rawPhrase: `+${statAmount} Defense` }
          ],
          choiceLabels: [`+${statAmount} Offense`, `+${statAmount} Defense`]
        });
      } else {
        effects.push({
          type: 'buff_stat',
          stat: statType,
          amount: statAmount
        });
      }
    } else if (builderEffectCategory === 'skill') {
      if (skillTokenChoice === 'any') {
        effects.push({
          type: 'grant_token',
          skillOptions: ['ass', 'raid', 'sub'],
          amount: 1
        });
      } else {
        effects.push({
          type: 'grant_token',
          skill: skillTokenChoice,
          amount: 1
        });
      }
    } else if (builderEffectCategory === 'draw') {
      effects.push({ type: 'draw', amount: drawAmount });
    } else if (builderEffectCategory === 'siphon') {
      effects.push({ type: 'siphon', amount: siphonAmount });
    } else if (builderEffectCategory === 'discard') {
      if (discardMode === 'choice') {
        effects.push({
          type: 'choice',
          choices: [
            { type: 'discard_hand', amount: discardHandCount, rawPhrase: `Force discard ${discardHandCount} from hand` },
            { type: 'discard_field', amount: discardFieldCount, rawPhrase: `Discard ${discardFieldCount} cards in play` }
          ],
          choiceLabels: [`Discard ${discardHandCount} From Hand`, `Discard ${discardFieldCount} In Play`]
        });
      } else if (discardMode === 'hand') {
        effects.push({ type: 'discard_hand', amount: discardHandCount });
      } else {
        effects.push({ type: 'discard_field', amount: discardFieldCount });
      }
    } else if (builderEffectCategory === 'spawn') {
      effects.push({
        type: 'spawn_token',
        tokenName,
        tokenOff,
        tokenDef
      });
    } else if (builderEffectCategory === 'defense') {
      effects.push({
        type: 'intercept_defense',
        amount: defenseBonus
      });
    }

    const generated = parser.generateStandardizedText({
      trigger: builderTrigger,
      targetType: builderTarget,
      effects,
      costCoins: costCoins > 0 ? costCoins : undefined,
      canPlayOnDefense: builderTrigger === 'reaction_defense'
    });

    setText(generated);
    const p = parser.parseAbility(generated);
    onUpdateText(generated, p);
    setActiveTab('syntax');
  };

  const handleInsertKeyword = (keyword: string) => {
    const updated = text ? `${text} ${keyword}` : keyword;
    handleTextChange(updated);
  };

  // Sandbox simulation runner
  const runSandboxTest = () => {
    const logs: string[] = [];
    logs.push(`🚀 Simulating Action Execution: [${parsed.summary}]`);

    // Costs
    if (parsed.trigger === 'tap') {
      logs.push(`⚡ Cost Paid: Card exhausted (E).`);
    } else if (parsed.trigger === 'sacrifice') {
      logs.push(`🔥 Cost Paid: Card moved to Discard Pile.`);
    } else if (parsed.trigger === 'reaction_defense') {
      logs.push(`🛡️ Cost Paid: Played as instant out-of-turn defensive reaction.`);
    }

    // Effects
    let currentOppHand = sandboxOpponentState.hand;
    let currentOppCoins = sandboxOpponentState.coins;
    let currentOppInPlay = sandboxOpponentState.inPlay;
    let currentBuff = { ...sandboxOpBuff };

    for (const eff of parsed.effects) {
      if (eff.type === 'buff_stat') {
        if (eff.stat === 'off') {
          currentBuff.off += eff.amount || 1;
          logs.push(`⚔️ Friendly Operative gained +${eff.amount} Offense (New OFF: ${currentBuff.off}).`);
        } else if (eff.stat === 'def') {
          currentBuff.def += eff.amount || 1;
          logs.push(`🛡️ Friendly Operative gained +${eff.amount} Defense (New DEF: ${currentBuff.def}).`);
        }
      } else if (eff.type === 'grant_token') {
        const tok = eff.skill ? eff.skill.toUpperCase() : 'ASS';
        currentBuff.tokens.push(`+1 ${tok}`);
        logs.push(`🎖️ Granted +1 ${tok} token to Friendly Operative.`);
      } else if (eff.type === 'draw') {
        logs.push(`🎴 Player drew ${eff.amount || 1} card(s) from deck.`);
      } else if (eff.type === 'siphon') {
        const stolen = Math.min(eff.amount || 2, currentOppCoins);
        currentOppCoins -= stolen;
        logs.push(`💰 Siphoned ${stolen} coin(s) from Opponent (Opponent Coins remaining: ${currentOppCoins}).`);
      } else if (eff.type === 'discard_hand') {
        currentOppHand = Math.max(0, currentOppHand - (eff.amount || 1));
        logs.push(`🗑️ Opponent forced to discard ${eff.amount || 1} card from hand (Opponent Hand remaining: ${currentOppHand}).`);
      } else if (eff.type === 'discard_field') {
        currentOppInPlay = Math.max(0, currentOppInPlay - (eff.amount || 2));
        logs.push(`💥 Discarded ${eff.amount || 2} opponent card(s) in play.`);
      } else if (eff.type === 'spawn_token') {
        logs.push(`👥 Deployed ${eff.tokenOff}/${eff.tokenDef} ${eff.tokenName || 'Operative'} token into play.`);
      } else if (eff.type === 'intercept_defense') {
        logs.push(`🛡️ Intercept defense fortified by +${eff.amount || 2} DEF against incoming threat!`);
      } else if (eff.type === 'choice') {
        logs.push(`🔀 Prompted modal choice: [${eff.choiceLabels?.join(' OR ')}]. Choice executed successfully.`);
      }
    }

    logs.push(`✅ Action resolved cleanly with no errors.`);
    setSandboxOpBuff(currentBuff);
    setSandboxOpponentState({ hand: currentOppHand, coins: currentOppCoins, inPlay: currentOppInPlay });
    setSandboxLog(logs);
  };

  const resetSandbox = () => {
    setSandboxOpBuff({ off: 2, def: 2, tokens: [] });
    setSandboxOpponentState({ hand: 4, coins: 5, inPlay: 3 });
    setSandboxLog(['Sandbox state reset to initial conditions.']);
  };

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/70 overflow-hidden text-xs font-sans">
      {/* Editor Header Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Action &amp; Ability Rule Editor</span>
        </div>

        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('syntax')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              activeTab === 'syntax' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Syntax / Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              activeTab === 'visual' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Rule Builder
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
              activeTab === 'sandbox' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Play className="w-2.5 h-2.5" />
            <span>Sandbox Test</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Syntax & Text Mode */}
      {activeTab === 'syntax' && (
        <div className="p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono text-zinc-300 font-semibold flex items-center gap-1">
                <span>Special Ability Description &amp; Keywords</span>
              </label>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
                parsed.isValid 
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40' 
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                {parsed.isValid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Engine Recognized</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-zinc-400" />
                    <span>Passive / Freeform</span>
                  </>
                )}
              </span>
            </div>

            <textarea
              rows={3}
              value={text}
              onChange={e => handleTextChange(e.target.value)}
              placeholder="e.g. Tap: Give target friendly operative +1 OFF or +1 DEF."
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 leading-relaxed font-mono"
            />
          </div>

          {/* Quick Keyword Inserter Chips */}
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 mb-1.5 uppercase font-semibold">
              Quick Keyword Chips (Click to Insert)
            </span>
            <div className="flex flex-wrap gap-1">
              {[
                'Tap:',
                'Sacrifice:',
                'On Deploy:',
                'Intercept Reaction:',
                'Give target friendly operative +1 OFF',
                'Give target friendly operative +1 DEF',
                'Grant +1 SUB, ASS, or RAID token',
                'Draw 1 card',
                'Siphon 2 coins from Opponent',
                'Discard 1 card from hand or 2 cards in play',
                'Spawn a 1/1 Shadow Warrior token',
                '+2 DEF to Intercept'
              ].map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleInsertKeyword(chip)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border border-zinc-700/70 text-[10px] font-mono transition-colors"
                >
                  +{chip}
                </button>
              ))}
            </div>
          </div>

          {/* Live Engine Action Interpretation Status */}
          <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 font-mono text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-semibold flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-amber-400" />
                Live Engine Action Interpretation:
              </span>
            </div>
            <div className="text-amber-300 font-semibold">
              {parsed.summary}
            </div>

            {parsed.recognizedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {parsed.recognizedKeywords.map((kw, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                    ✓ {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Visual Rule Builder */}
      {activeTab === 'visual' && (
        <div className="p-3 space-y-3 font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Trigger Selector */}
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-semibold">
                1. Activation Trigger
              </label>
              <select
                value={builderTrigger}
                onChange={e => setBuilderTrigger(e.target.value as AbilityTriggerType)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="tap">⚡ Tap / Exhaust (In Play)</option>
                <option value="sacrifice">🔥 Sacrifice (From Play to Discard)</option>
                <option value="deploy">✨ On Deploy (When Cast)</option>
                <option value="reaction_defense">🛡️ Intercept Reaction (Out-of-Turn)</option>
                <option value="passive">⚙️ Passive Effect</option>
              </select>
            </div>

            {/* Target Selector */}
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-semibold">
                2. Target Scope
              </label>
              <select
                value={builderTarget}
                onChange={e => setBuilderTarget(e.target.value as AbilityTargetType)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="friendly_op">Friendly Operative</option>
                <option value="all_friendly_ops">All Friendly Operatives</option>
                <option value="enemy_op">Enemy Operative</option>
                <option value="opponent">Opponent (Hand / Resources)</option>
                <option value="none">Self / Global Game State</option>
              </select>
            </div>
          </div>

          {/* Effect Category Tabs */}
          <div>
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-semibold">
              3. Effect Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-1">
              {[
                { id: 'buff', label: 'Stat Buff' },
                { id: 'skill', label: 'Skill Token' },
                { id: 'draw', label: 'Draw' },
                { id: 'siphon', label: 'Siphon' },
                { id: 'discard', label: 'Discard' },
                { id: 'spawn', label: 'Spawn Token' },
                { id: 'defense', label: 'Intercept' }
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setBuilderEffectCategory(cat.id as any)}
                  className={`py-1 px-1.5 rounded text-[10px] text-center border transition-colors ${
                    builderEffectCategory === cat.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category-Specific Configuration */}
          <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
            {builderEffectCategory === 'buff' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Buff Type</label>
                  <select
                    value={statType}
                    onChange={e => setStatType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="both_choice">Modal Choice: +OFF or +DEF</option>
                    <option value="off">Offense Only (+OFF)</option>
                    <option value="def">Defense Only (+DEF)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Amount</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={statAmount}
                    onChange={e => setStatAmount(parseInt(e.target.value) || 1)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {builderEffectCategory === 'skill' && (
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Token Skill</label>
                <select
                  value={skillTokenChoice}
                  onChange={e => setSkillTokenChoice(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                >
                  <option value="any">Choice of Any: +1 SUB, ASS, or RAID</option>
                  <option value="ass">+1 Assassin Token Only</option>
                  <option value="raid">+1 Raid Token Only</option>
                  <option value="sub">+1 Subterfuge Token Only</option>
                </select>
              </div>
            )}

            {builderEffectCategory === 'draw' && (
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Cards to Draw</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={drawAmount}
                  onChange={e => setDrawAmount(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            )}

            {builderEffectCategory === 'siphon' && (
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Coins to Siphon</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={siphonAmount}
                  onChange={e => setSiphonAmount(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            )}

            {builderEffectCategory === 'discard' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Discard Target</label>
                  <select
                    value={discardMode}
                    onChange={e => setDiscardMode(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="choice">Choice: 1 From Hand OR 2 In Play</option>
                    <option value="hand">Hand Discard Only</option>
                    <option value="field">In-Play Field Discard Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Card Count</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={discardMode === 'field' ? discardFieldCount : discardHandCount}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 1;
                      if (discardMode === 'field') setDiscardFieldCount(v);
                      else setDiscardHandCount(v);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {builderEffectCategory === 'spawn' && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Token Name</label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={e => setTokenName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Offense</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={tokenOff}
                    onChange={e => setTokenOff(parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Defense</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={tokenDef}
                    onChange={e => setTokenDef(parseInt(e.target.value) || 0)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {builderEffectCategory === 'defense' && (
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Bonus Intercept Defense</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={defenseBonus}
                  onChange={e => setDefenseBonus(parseInt(e.target.value) || 2)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyBuilderToText}
            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate &amp; Apply Standardized Rule Syntax</span>
          </button>
        </div>
      )}

      {/* TAB 3: Interactive Sandbox Test Simulator */}
      {activeTab === 'sandbox' && (
        <div className="p-3 space-y-3 font-mono">
          <div className="flex items-center justify-between text-[11px] text-zinc-300">
            <span className="font-semibold flex items-center gap-1">
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dry-Run Action Simulator</span>
            </span>
            <button
              type="button"
              onClick={resetSandbox}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset State</span>
            </button>
          </div>

          {/* Mock Scenario State */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-zinc-400 font-bold block">Friendly Mock Target:</span>
              <div className="text-amber-400">
                Operative: <strong>{sandboxOpBuff.off} OFF</strong> / <strong>{sandboxOpBuff.def} DEF</strong>
              </div>
              {sandboxOpBuff.tokens.length > 0 && (
                <div className="text-emerald-400">
                  Tokens: {sandboxOpBuff.tokens.join(', ')}
                </div>
              )}
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-zinc-400 font-bold block">Opponent Mock State:</span>
              <div className="text-zinc-300">
                Hand: <strong>{sandboxOpponentState.hand}</strong> cards | Coins: <strong>{sandboxOpponentState.coins}</strong> | In-Play: <strong>{sandboxOpponentState.inPlay}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={runSandboxTest}
            className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Execute Test Simulation</span>
          </button>

          {/* Sandbox Logs */}
          <div className="p-2.5 rounded-lg bg-black border border-zinc-800 max-h-36 overflow-y-auto space-y-1 text-[10px]">
            {sandboxLog.length === 0 ? (
              <span className="text-zinc-500 italic">Click "Execute Test Simulation" to dry-run this ability against the mock scenario.</span>
            ) : (
              sandboxLog.map((log, idx) => (
                <div key={idx} className="text-zinc-300 leading-tight">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
