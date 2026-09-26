import React, { useState, useMemo } from 'react';
import { 
  AbilityParserService, 
  AbilityTriggerType, 
  AbilityTargetType, 
  AtomicEffect, 
  ParsedAbilityDefinition 
} from '../services/abilityParserService';
import { 
  KeywordRegistryService, 
  KeywordDefinition, 
  KeywordCategory 
} from '../services/keywordRegistryService';
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
  Crosshair,
  BookOpen,
  Trash2,
  X,
  PlusCircle,
  ArrowRight
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
  const keywordRegistry = KeywordRegistryService.getInstance();

  const [activeTab, setActiveTab] = useState<'syntax' | 'visual' | 'sandbox' | 'keywords'>('syntax');
  const [text, setText] = useState<string>(initialText);

  // Keyword Registry UI State
  const [keywords, setKeywords] = useState<KeywordDefinition[]>(() => keywordRegistry.getAllKeywords());
  const [selectedKwCategory, setSelectedKwCategory] = useState<'all' | KeywordCategory>('all');
  const [showNewKeywordModal, setShowNewKeywordModal] = useState(false);
  
  // Custom Keyword Form State
  const [newKwKeyword, setNewKwKeyword] = useState('');
  const [newKwCategory, setNewKwCategory] = useState<KeywordCategory>('trigger');
  const [newKwTemplate, setNewKwTemplate] = useState('');
  const [newKwDesc, setNewKwDesc] = useState('');
  const [newKwParamType, setNewKwParamType] = useState<'number' | 'none'>('number');
  const [newKwDefaultVal, setNewKwDefaultVal] = useState<number>(1);
  const [newKwSample, setNewKwSample] = useState('');

  // Quick Chip Parameter State
  const [chipParamX, setChipParamX] = useState<number>(1);

  // Visual Builder State
  const [builderTrigger, setBuilderTrigger] = useState<'tap' | 'passive' | 'tap_pay' | 'passive_pay' | 'sacrifice' | 'deploy' | 'reaction_defense' | 'intercept' | 'interrupt'>('tap');
  const [builderTarget, setBuilderTarget] = useState<AbilityTargetType>('friendly_op');
  const [builderEffectCategory, setBuilderEffectCategory] = useState<'buff' | 'tech_token' | 'skill' | 'draw' | 'siphon' | 'discard' | 'spawn' | 'defense' | 'deploy' | 'exhaust' | 'gain_resource' | 'cost_discount'>('buff');
  const [gainResourceType, setGainResourceType] = useState<'fixed' | 'discard_cost'>('fixed');
  const [gainResourceAmount, setGainResourceAmount] = useState<number>(2);
  const [discountCardType, setDiscountCardType] = useState<'Operative' | 'Location' | 'Support' | 'any'>('Operative');
  const [discountAmount, setDiscountAmount] = useState<number>(1);
  const [deployTargetType, setDeployTargetType] = useState<'Operative' | 'Location' | 'Support' | 'any'>('Operative');
  const [deployCount, setDeployCount] = useState<number>(2);
  const [exhaustCount, setExhaustCount] = useState<number>(1);
  const [exhaustTargetType, setExhaustTargetType] = useState<'card' | 'operative' | 'location'>('card');
  const [builderDiscardEndTurn, setBuilderDiscardEndTurn] = useState<boolean>(false);
  const [statType, setStatType] = useState<'off' | 'def' | 'both_choice'>('both_choice');
  const [statAmount, setStatAmount] = useState<number>(1);
  const [techTokenAmount, setTechTokenAmount] = useState<number>(1);
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
  const [costCoins, setCostCoins] = useState<number>(1);

  // Sandbox Test Simulation State
  const [sandboxLog, setSandboxLog] = useState<string[]>([]);
  const [sandboxOpBuff, setSandboxOpBuff] = useState<{ off: number; def: number; tech: number; tokens: string[] }>({ off: 2, def: 2, tech: 0, tokens: [] });
  const [sandboxCardExhausted, setSandboxCardExhausted] = useState<boolean>(false);
  const [sandboxPlayerSpendables, setSandboxPlayerSpendables] = useState<number>(4);
  const [sandboxOpponentState, setSandboxOpponentState] = useState<{ hand: number; coins: number; inPlay: number }>({ hand: 4, coins: 5, inPlay: 3 });

  // Live parsed result
  const parsed = useMemo(() => {
    return parser.parseAbility(text);
  }, [text, parser]);

  const refreshKeywords = () => {
    setKeywords(keywordRegistry.getAllKeywords());
  };

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
    } else if (builderEffectCategory === 'tech_token') {
      effects.push({
        type: 'grant_token',
        tokenType: 'tech',
        stat: 'both',
        amount: techTokenAmount,
        rawPhrase: `+${techTokenAmount}/+${techTokenAmount} Tech token`
      });
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
    } else if (builderEffectCategory === 'deploy') {
      effects.push({
        type: 'deploy_card',
        deployCardType: deployTargetType,
        deployCount: deployCount,
        amount: deployCount
      });
    } else if (builderEffectCategory === 'exhaust') {
      effects.push({
        type: 'exhaust_card',
        amount: exhaustCount,
        exhaustCount: exhaustCount,
        exhaustTargetType: exhaustTargetType
      });
    } else if (builderEffectCategory === 'gain_resource') {
      if (gainResourceType === 'discard_cost') {
        effects.push({
          type: 'gain_resource_discard_cost',
          amount: 1,
          rawPhrase: 'Discards 1 card from hand, gain x resource equal to discarded card'
        });
      } else {
        effects.push({
          type: 'gain_resource',
          amount: gainResourceAmount,
          rawPhrase: `gain ${gainResourceAmount} resource${gainResourceAmount > 1 ? 's' : ''}`
        });
      }
    } else if (builderEffectCategory === 'cost_discount') {
      effects.push({
        type: 'cost_discount',
        discountCardType: discountCardType,
        discountAmount: discountAmount,
        amount: discountAmount,
        rawPhrase: `${discountCardType} cost ${discountAmount} less resource to deploy`
      });
    }

    const isTapPay = builderTrigger === 'tap_pay';
    const isPassivePay = builderTrigger === 'passive_pay';
    const isPassiveOnly = builderTrigger === 'passive' || builderEffectCategory === 'cost_discount';
    const requiresPay = isTapPay || isPassivePay;
    const finalTrigger: AbilityTriggerType = 
      isPassivePay || isPassiveOnly ? 'passive' : 
      isTapPay ? 'tap' : 
      builderTrigger as AbilityTriggerType;

    const generated = parser.generateStandardizedText({
      trigger: finalTrigger,
      targetType: builderEffectCategory === 'exhaust' ? 'opponent' : builderEffectCategory === 'cost_discount' ? 'none' : builderTarget,
      effects,
      costCoins: requiresPay ? Math.max(1, costCoins) : undefined,
      isPassive: isPassiveOnly || isPassivePay,
      canPlayOnDefense: builderTrigger === 'reaction_defense' || builderTrigger === 'intercept',
      discardAtEndOfTurn: builderDiscardEndTurn
    });

    setText(generated);
    const p = parser.parseAbility(generated);
    onUpdateText(generated, p);
    setActiveTab('syntax');
  };

  const handleInsertKeyword = (phrase: string) => {
    const updated = text.trim() ? `${text.trim()} ${phrase}` : phrase;
    handleTextChange(updated);
  };

  const handleCreateCustomKeyword = () => {
    if (!newKwKeyword.trim() || !newKwTemplate.trim()) return;
    keywordRegistry.addCustomKeyword({
      keyword: newKwKeyword.trim(),
      category: newKwCategory,
      syntaxTemplate: newKwTemplate.trim(),
      description: newKwDesc.trim() || `Custom ${newKwCategory} keyword`,
      parameterType: newKwParamType,
      defaultParamValue: newKwDefaultVal,
      sampleUsage: newKwSample.trim()
    });
    refreshKeywords();
    setShowNewKeywordModal(false);
    setNewKwKeyword('');
    setNewKwTemplate('');
    setNewKwDesc('');
  };

  const handleDeleteCustomKeyword = (id: string) => {
    keywordRegistry.deleteCustomKeyword(id);
    refreshKeywords();
  };

  // Sandbox simulation runner
  const runSandboxTest = () => {
    const logs: string[] = [];
    logs.push(`🚀 Simulating Action Execution: [${parsed.summary}]`);

    // 1. Check & Pay Resource Cost ("Pay x")
    let spendables = sandboxPlayerSpendables;
    if (parsed.costCoins && parsed.costCoins > 0) {
      if (spendables < parsed.costCoins) {
        logs.push(`❌ ACTIVATION FAILED: Requires ${parsed.costCoins} coin(s), but player only has ${spendables} Spendable(s).`);
        setSandboxLog(logs);
        return;
      }
      spendables -= parsed.costCoins;
      logs.push(`🪙 Resource Cost Paid: Deducted ${parsed.costCoins} Spendable coin(s) (Remaining spendables: ${spendables}).`);
    }

    // 2. Trigger exhaustion vs Passive
    let isExhausted = sandboxCardExhausted;
    if (parsed.isPassive || parsed.trigger === 'passive') {
      logs.push(`⚙️ Passive Ability Triggered: Card DOES NOT exhaust and remains Ready (R)!`);
    } else if (parsed.requiresTap || parsed.trigger === 'tap') {
      isExhausted = true;
      logs.push(`⚡ Cost Paid: Card exhausted (E).`);
    } else if (parsed.trigger === 'sacrifice' || parsed.requiresSacrifice) {
      logs.push(`🔥 Cost Paid: Card moved to Discard Pile (Sacrifice).`);
    } else if (parsed.trigger === 'reaction_defense') {
      logs.push(`🛡️ Cost Paid: Played as instant out-of-turn defensive reaction.`);
    }

    // 3. Effects
    let currentOppHand = sandboxOpponentState.hand;
    let currentOppCoins = sandboxOpponentState.coins;
    let currentOppInPlay = sandboxOpponentState.inPlay;
    let currentBuff = { ...sandboxOpBuff };

    for (const eff of parsed.effects) {
      if (eff.type === 'grant_token' && (eff.tokenType === 'tech' || eff.stat === 'both')) {
        const amt = eff.amount || 1;
        currentBuff.tech += amt;
        currentBuff.off += amt;
        currentBuff.def += amt;
        currentBuff.tokens.push(`+${amt}/+${amt} Tech`);
        logs.push(`⚡ Granted +${amt}/+${amt} Tech Token! Friendly Operative OFF: ${currentBuff.off} / DEF: ${currentBuff.def}.`);
      } else if (eff.type === 'buff_stat') {
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
      } else if (eff.type === 'deploy_card') {
        const cnt = eff.deployCount || eff.amount || 1;
        const target = eff.deployCardType === 'any' || !eff.deployCardType ? 'any card' : `${eff.deployCardType} card`;
        logs.push(`🚀 Free Deploy Keyword Activated: Allowed putting into play ${cnt} ${target}${cnt > 1 ? 's' : ''} from hand WITHOUT paying card cost!`);
      } else if (eff.type === 'exhaust_card') {
        const cnt = eff.amount || 1;
        logs.push(`💤 Exhaust Keyword Activated: Changed ${cnt} opponent's card(s) to Exhaust condition to prevent resource production or special abilities!`);
      } else if (eff.type === 'cost_discount') {
        const cType = eff.discountCardType || 'Operative';
        const amt = eff.discountAmount || eff.amount || 1;
        logs.push(`🏷️ Passive Cost Discount: Friendly ${cType} cards cost ${amt} less resource to deploy (e.g. 3-cost Operatives deploy for ${Math.max(0, 3 - amt)} spendables).`);
      }
    }

    if (parsed.isIntercept) {
      logs.push(`🛡️ Intercept Keyword: Card can be deployed or use its special ability out of turn when attacked!`);
    }
    if (parsed.isInterrupt) {
      logs.push(`⚡ Interrupt Keyword: Card can be played anytime out of player's turn, even when not being attacked!`);
    }
    if (parsed.discardAtEndOfTurn) {
      logs.push(`⏳ Discard at end of turn: Automatically flagged to discard to the discard pile at the end of player's turn.`);
    }

    logs.push(`✅ Action resolved cleanly with no errors.`);
    setSandboxOpBuff(currentBuff);
    setSandboxCardExhausted(isExhausted);
    setSandboxPlayerSpendables(spendables);
    setSandboxOpponentState({ hand: currentOppHand, coins: currentOppCoins, inPlay: currentOppInPlay });
    setSandboxLog(logs);
  };

  const resetSandbox = () => {
    setSandboxOpBuff({ off: 2, def: 2, tech: 0, tokens: [] });
    setSandboxCardExhausted(false);
    setSandboxPlayerSpendables(4);
    setSandboxOpponentState({ hand: 4, coins: 5, inPlay: 3 });
    setSandboxLog(['Sandbox state reset to initial conditions.']);
  };

  const filteredKeywords = selectedKwCategory === 'all' 
    ? keywords 
    : keywords.filter(k => k.category === selectedKwCategory);

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/70 overflow-hidden text-xs font-sans">
      {/* Editor Header Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Action Studio Rule Engine</span>
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
          <button
            type="button"
            onClick={() => setActiveTab('keywords')}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1 ${
              activeTab === 'keywords' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-cyan-400 hover:text-cyan-200'
            }`}
          >
            <BookOpen className="w-2.5 h-2.5 text-cyan-400" />
            <span>Keyword Studio</span>
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
              placeholder="e.g. Tap, Pay 2 coins: Give target friendly operative +1/+1 Tech token."
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 leading-relaxed font-mono"
            />
          </div>

          {/* Quick Keyword Inserter Chips with Parameter Control */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold flex items-center gap-1">
                <span>Quick Keyword Chips</span>
                <span className="text-zinc-500">({keywords.length} available)</span>
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-zinc-400">Param x:</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={chipParamX}
                  onChange={e => setChipParamX(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-amber-400 font-bold text-center"
                />
              </div>
            </div>

            {/* Triggers & Costs Chips */}
            <div className="space-y-1">
              <span className="text-[9px] font-mono text-amber-400/80 uppercase font-bold">Triggers &amp; Multi-Triggers:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Tap:`)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border border-zinc-700/70 text-[10px] font-mono transition-colors"
                >
                  +Tap:
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Passive:`)}
                  className="px-2 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/70 text-[10px] font-mono transition-colors font-semibold"
                >
                  +Passive:
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Pay ${chipParamX} coin${chipParamX > 1 ? 's' : ''}:`)}
                  className="px-2 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-700/70 text-[10px] font-mono transition-colors font-semibold"
                >
                  +Pay {chipParamX} coin{chipParamX > 1 ? 's' : ''}:
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Tap, Pay ${chipParamX} coin${chipParamX > 1 ? 's' : ''}:`)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono transition-colors font-bold"
                >
                  +Tap, Pay {chipParamX} coins:
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Passive, Pay ${chipParamX} coin${chipParamX > 1 ? 's' : ''}:`)}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono transition-colors font-bold"
                >
                  +Passive, Pay {chipParamX} coins:
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Sacrifice:`)}
                  className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-700/70 text-[10px] font-mono transition-colors"
                >
                  +Sacrifice:
                </button>
              </div>
            </div>

            {/* Tokens & Effects Chips */}
            <div className="space-y-1 pt-1">
              <span className="text-[9px] font-mono text-cyan-400/80 uppercase font-bold">Tokens &amp; Effects:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Give target friendly operative +${chipParamX}/+${chipParamX} Tech token.`)}
                  className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  ++{chipParamX}/+{chipParamX} Tech token
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Give target friendly operative +1 OFF or +1 DEF.`)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono transition-colors"
                >
                  ++1 OFF or +1 DEF
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Grant +1 SUB, ASS, or RAID token.`)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono transition-colors"
                >
                  +Grant Skill Token
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Draw ${chipParamX} card${chipParamX > 1 ? 's' : ''}.`)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono transition-colors"
                >
                  +Draw {chipParamX} card(s)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Siphon 2 coins from Opponent.`)}
                  className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono transition-colors"
                >
                  +Siphon 2 coins
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Deploy ${chipParamX} Operative card${chipParamX > 1 ? 's' : ''} from your hand.`)}
                  className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Deploy {chipParamX} Operative(s)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Deploy ${chipParamX} Location card${chipParamX > 1 ? 's' : ''} from your hand.`)}
                  className="px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Deploy {chipParamX} Location(s)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Deploy ${chipParamX} Support card${chipParamX > 1 ? 's' : ''} from your hand.`)}
                  className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Deploy {chipParamX} Support(s)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Deploy any ${chipParamX} card${chipParamX > 1 ? 's' : ''} from your hand.`)}
                  className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Deploy Any {chipParamX}
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Exhaust ${chipParamX} opponent's card${chipParamX > 1 ? 's' : ''}.`)}
                  className="px-2 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Exhaust {chipParamX} Card(s)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Intercept.`)}
                  className="px-2 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Intercept
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Interrupt.`)}
                  className="px-2 py-0.5 rounded bg-yellow-950/80 hover:bg-yellow-900 text-yellow-300 border border-yellow-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Interrupt
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Discard at end of turn.`)}
                  className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Discard at end of turn
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Gain ${chipParamX} resource${chipParamX > 1 ? 's' : ''}.`)}
                  className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Gain {chipParamX} Resource(s)
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Discards 1 card from hand, gain x resource equal to discarded card.`)}
                  className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Discard Hand for Equal Resources
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertKeyword(`Operative cost ${chipParamX} less resource to deploy.`)}
                  className="px-2 py-0.5 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-600/70 text-[10px] font-mono transition-colors font-bold"
                >
                  +Operative cost {chipParamX} less resource
                </button>
              </div>
            </div>
          </div>

          {/* Live Engine Action Interpretation Status */}
          <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 font-mono text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 font-semibold flex items-center gap-1">
                <Crosshair className="w-3 h-3 text-amber-400" />
                Live Engine Action Interpretation:
              </span>
              <div className="flex items-center gap-1">
                {parsed.isPassive && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 text-[9px] font-bold">
                    PASSIVE (NO EXHAUST)
                  </span>
                )}
                {parsed.costCoins && parsed.costCoins > 0 ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 text-[9px] font-bold">
                    PAY {parsed.costCoins} RESOURCE{parsed.costCoins > 1 ? 'S' : ''}
                  </span>
                ) : null}
              </div>
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
                1. Activation Trigger &amp; Multi-Trigger
              </label>
              <select
                value={builderTrigger}
                onChange={e => setBuilderTrigger(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="tap">⚡ Tap / Exhaust (In Play)</option>
                <option value="passive">⚙️ Passive (Does NOT Exhaust card)</option>
                <option value="tap_pay">⚡ Tap + Pay Resources (Multi-Trigger)</option>
                <option value="passive_pay">⚙️ Passive + Pay Resources (Multi-Trigger, No Exhaust)</option>
                <option value="sacrifice">🔥 Sacrifice (From Play to Discard)</option>
                <option value="deploy">✨ On Deploy (When Cast)</option>
                <option value="reaction_defense">🛡️ Intercept Reaction (Out-of-Turn)</option>
                <option value="intercept">🛡️ Intercept (Deploy / Special Ability Out-of-Turn When Attacked)</option>
                <option value="interrupt">⚡ Interrupt (Play Anytime Out-of-Turn)</option>
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
                <option value="opponent">Opponent (Hand / Resources / In-Play)</option>
                <option value="none">Self / Global Game State</option>
              </select>
            </div>
          </div>

          {/* Pay x Resource Requirement Input if Multi-trigger or Pay selected */}
          {(builderTrigger === 'tap_pay' || builderTrigger === 'passive_pay') && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-600/40 flex items-center justify-between gap-3">
              <div>
                <span className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  Resource Cost Requirement ("Pay x")
                </span>
                <p className="text-[10px] text-zinc-400">
                  Player must have at least this amount in Spendables; action will be disabled if insufficient.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 text-xs">Pay:</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={costCoins}
                  onChange={e => setCostCoins(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-amber-300 font-bold text-center"
                />
                <span className="text-zinc-400 text-xs">Coins</span>
              </div>
            </div>
          )}

          {/* Effect Category Tabs */}
          <div>
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase font-semibold">
              3. Effect Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
              {[
                { id: 'tech_token', label: '⚡ +x/+x Tech' },
                { id: 'buff', label: '⚔️ Stat Buff' },
                { id: 'skill', label: '🎖️ Skill Token' },
                { id: 'draw', label: '🎴 Draw Cards' },
                { id: 'siphon', label: '💰 Siphon Coins' },
                { id: 'discard', label: '🗑️ Discard' },
                { id: 'spawn', label: '👥 Spawn Token' },
                { id: 'defense', label: '🛡️ Intercept DEF' },
                { id: 'deploy', label: '🚀 Deploy Free' },
                { id: 'exhaust', label: '💤 Exhaust Card' },
                { id: 'gain_resource', label: '💎 Gain Resource' },
                { id: 'cost_discount', label: '🏷️ Cost Discount' }
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
            {builderEffectCategory === 'tech_token' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-cyan-300 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tech Token Buff Amount (+x/+x)</span>
                  </label>
                  <span className="text-[10px] text-zinc-400">Buffs BOTH Offense and Defense</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={techTokenAmount}
                    onChange={e => setTechTokenAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 bg-zinc-950 border border-cyan-600/60 rounded px-2.5 py-1 text-xs text-cyan-300 font-bold text-center"
                  />
                  <span className="text-zinc-300 text-xs">
                    Grants <strong className="text-cyan-300">+{techTokenAmount}/+{techTokenAmount} Tech token</strong> to target operative.
                  </span>
                </div>
              </div>
            )}

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

            {builderEffectCategory === 'deploy' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Target Card Type</label>
                  <select
                    value={deployTargetType}
                    onChange={e => setDeployTargetType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="Operative">Operative (Units)</option>
                    <option value="Location">Location (Buildings)</option>
                    <option value="Support">Support (Spells/Actions)</option>
                    <option value="any">Any Card Type (Variation: Deploy any x)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Number of Cards (x)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={deployCount}
                    onChange={e => setDeployCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold text-center"
                  />
                </div>
                <div className="col-span-2 text-[11px] text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-800/50">
                  ✨ <strong>Keyword Effect:</strong> Put into play {deployCount} {deployTargetType === 'any' ? 'card(s) of any type' : `${deployTargetType} card(s)`} from hand <strong>without paying card cost</strong>!
                </div>
              </div>
            )}

            {builderEffectCategory === 'exhaust' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Target Card Type</label>
                  <select
                    value={exhaustTargetType}
                    onChange={e => setExhaustTargetType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="card">Any Card (In Play)</option>
                    <option value="operative">Operative Only</option>
                    <option value="location">Location Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Number of Cards (x)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={exhaustCount}
                    onChange={e => setExhaustCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-purple-400 font-bold text-center"
                  />
                </div>
                <div className="col-span-2 text-[11px] text-purple-300 bg-purple-950/40 p-2 rounded border border-purple-800/50">
                  💤 <strong>Keyword Effect:</strong> Put {exhaustCount} opponent's {exhaustTargetType === 'card' ? 'card(s)' : `${exhaustTargetType}(s)`} to <strong>Exhaust condition</strong> to prevent resource production or special abilities!
                </div>
              </div>
            )}

            {builderEffectCategory === 'gain_resource' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Resource Gain Mode</label>
                    <select
                      value={gainResourceType}
                      onChange={e => setGainResourceType(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="fixed">Fixed Spendable Amount ("Gain x resource")</option>
                      <option value="discard_cost">Equal to Discarded Card Cost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">
                      {gainResourceType === 'fixed' ? 'Resource Amount (x)' : 'Mode Details'}
                    </label>
                    {gainResourceType === 'fixed' ? (
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={gainResourceAmount}
                        onChange={e => setGainResourceAmount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold text-center"
                      />
                    ) : (
                      <div className="text-xs text-amber-400 font-bold py-1">
                        Determined by Card Cost
                      </div>
                    )}
                  </div>
                </div>
                <div className={`text-[11px] p-2 rounded border ${
                  gainResourceType === 'fixed'
                    ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/50'
                    : 'text-amber-300 bg-amber-950/40 border-amber-800/50'
                }`}>
                  {gainResourceType === 'fixed' ? (
                    <span>💎 <strong>Keyword Effect:</strong> Player gains <strong>{gainResourceAmount} Spendable resource(s)</strong> (turn coins).</span>
                  ) : (
                    <span>💎 <strong>Keyword Effect:</strong> Player discards 1 card from hand and gains <strong>Spendable resources equal to the discarded card's printed cost</strong>.</span>
                  )}
                </div>
              </div>
            )}

            {builderEffectCategory === 'cost_discount' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-teal-300 font-bold flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-teal-400" />
                    <span>Passive Deploy Cost Reduction</span>
                  </label>
                  <span className="text-[10px] text-zinc-400">Always active • Does not require tapping</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Target Card Type</label>
                    <select
                      value={discountCardType}
                      onChange={e => setDiscountCardType(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="Operative">Operative (Default)</option>
                      <option value="Location">Location</option>
                      <option value="Support">Support</option>
                      <option value="any">Any Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Resource Discount</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={discountAmount}
                      onChange={e => setDiscountAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-teal-300 font-bold text-center"
                    />
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-teal-800/50 text-[11px] text-teal-200/90 font-mono">
                  🏷️ <strong>Effect Preview:</strong> <span className="text-white font-bold">Passive: {discountCardType} cost {discountAmount} less resource to deploy.</span>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    Player receives a continuous -{discountAmount} resource discount whenever deploying a {discountCardType} card (min cost 0).
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Keyword Modifier: Discard at end of turn */}
          <div className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="builderDiscardEndTurn"
                checked={builderDiscardEndTurn}
                onChange={e => setBuilderDiscardEndTurn(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-700 text-rose-500 focus:ring-rose-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="builderDiscardEndTurn" className="text-xs text-zinc-300 cursor-pointer flex items-center gap-1.5 font-semibold">
                <span className="text-rose-400 font-bold">⏳ Discard at end of turn:</span>
                <span className="text-[11px] text-zinc-400">Card is automatically discarded at the end of the player's turn</span>
              </label>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-zinc-400 font-bold block">Active Player Resources:</span>
              <div className="flex items-center gap-1.5">
                <Coins className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 font-bold">{sandboxPlayerSpendables} Spendable Coins</span>
              </div>
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSandboxPlayerSpendables(prev => Math.max(0, prev - 1))}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxPlayerSpendables(prev => prev + 1)}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  +1
                </button>
              </div>
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-zinc-400 font-bold block">Mock Friendly Operative:</span>
              <div className="text-amber-400">
                Operative: <strong>{sandboxOpBuff.off} OFF</strong> / <strong>{sandboxOpBuff.def} DEF</strong>
              </div>
              <div className="text-[9px]">
                State: <strong className={sandboxCardExhausted ? 'text-zinc-400' : 'text-emerald-400'}>{sandboxCardExhausted ? 'Exhausted (E)' : 'Ready (R)'}</strong>
              </div>
              {sandboxOpBuff.tech > 0 && (
                <div className="text-cyan-300 font-semibold text-[9px]">
                  ⚡ Tech Buff: +{sandboxOpBuff.tech}/+{sandboxOpBuff.tech}
                </div>
              )}
            </div>

            <div className="p-2 rounded bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-zinc-400 font-bold block">Opponent Mock State:</span>
              <div className="text-zinc-300">
                Hand: <strong>{sandboxOpponentState.hand}</strong> | Coins: <strong>{sandboxOpponentState.coins}</strong> | Field: <strong>{sandboxOpponentState.inPlay}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={runSandboxTest}
            className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
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

      {/* TAB 4: Dynamic Keyword Registry & Custom Keyword Creator */}
      {activeTab === 'keywords' && (
        <div className="p-3 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dynamic Keyword Registry</span>
              </h4>
              <p className="text-[10px] text-zinc-400">
                Inspect built-in engine keywords or define your own dynamic keywords.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowNewKeywordModal(true)}
              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 transition-colors"
            >
              <PlusCircle className="w-3 h-3" />
              <span>Define Keyword</span>
            </button>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 flex-wrap text-[10px]">
            {(['all', 'trigger', 'cost', 'token', 'effect', 'modifier'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedKwCategory(cat)}
                className={`px-2 py-0.5 rounded capitalize transition-colors ${
                  selectedKwCategory === cat
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Keyword Grid / List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredKeywords.map(kw => (
              <div
                key={kw.id}
                className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-300 text-xs">{kw.keyword}</span>
                    <span className="text-[9px] uppercase px-1 rounded bg-zinc-800 text-zinc-400">
                      {kw.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const phrase = keywordRegistry.generatePhrase(kw, chipParamX);
                        handleInsertKeyword(phrase);
                        setActiveTab('syntax');
                      }}
                      className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-300 text-[9px] transition-colors"
                      title="Insert into syntax text"
                    >
                      Insert
                    </button>
                    {!kw.isBuiltIn && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomKeyword(kw.id)}
                        className="p-0.5 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Delete custom keyword"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-zinc-300 font-mono bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800/80">
                  {kw.syntaxTemplate}
                </div>
                <p className="text-[9px] text-zinc-400 leading-tight">
                  {kw.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Define Custom Keyword */}
      {showNewKeywordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-cyan-500/50 rounded-xl p-4 max-w-md w-full space-y-3 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4" />
                <span>Define New Dynamic Keyword</span>
              </span>
              <button
                type="button"
                onClick={() => setShowNewKeywordModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Keyword Name (e.g. Overdrive x)</label>
                <input
                  type="text"
                  value={newKwKeyword}
                  onChange={e => setNewKwKeyword(e.target.value)}
                  placeholder="e.g. Overdrive x"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-0.5">Category</label>
                  <select
                    value={newKwCategory}
                    onChange={e => setNewKwCategory(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white"
                  >
                    <option value="trigger">Trigger</option>
                    <option value="cost">Cost</option>
                    <option value="token">Token</option>
                    <option value="effect">Effect</option>
                    <option value="modifier">Modifier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-0.5">Parameter Type</label>
                  <select
                    value={newKwParamType}
                    onChange={e => setNewKwParamType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white"
                  >
                    <option value="number">Number {'({x})'}</option>
                    <option value="none">None (Static)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Syntax Template (use {'{x}'} for number)</label>
                <input
                  type="text"
                  value={newKwTemplate}
                  onChange={e => setNewKwTemplate(e.target.value)}
                  placeholder="e.g. Overdrive {x}: or +{x} Stealth"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-0.5">Description</label>
                <input
                  type="text"
                  value={newKwDesc}
                  onChange={e => setNewKwDesc(e.target.value)}
                  placeholder="What does this keyword do in the game?"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowNewKeywordModal(false)}
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomKeyword}
                disabled={!newKwKeyword.trim() || !newKwTemplate.trim()}
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs"
              >
                Save Keyword
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
