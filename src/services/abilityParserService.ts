/**
 * AbilityParserService
 * Standardized Keyword Syntax Interpreter and Engine Action Rule Compiler for Spywar
 */

import { KeywordRegistryService } from './keywordRegistryService';

export type AbilityTriggerType = 
  | 'tap' 
  | 'sacrifice' 
  | 'deploy' 
  | 'reaction_defense' 
  | 'pay_coins'
  | 'passive'
  | 'interrupt'
  | 'intercept';

export type AbilityTargetType = 
  | 'friendly_op' 
  | 'enemy_op' 
  | 'opponent' 
  | 'self' 
  | 'all_friendly_ops' 
  | 'none';

export type AtomicEffectType = 
  | 'buff_stat'
  | 'grant_token'
  | 'draw'
  | 'siphon'
  | 'discard_hand'
  | 'discard_field'
  | 'spawn_token'
  | 'intercept_defense'
  | 'produce_coins'
  | 'choice'
  | 'deploy_card'
  | 'exhaust_card';

export interface AtomicEffect {
  type: AtomicEffectType;
  stat?: 'off' | 'def' | 'both';
  tokenType?: 'skill' | 'tech' | 'custom' | string;
  skill?: 'ass' | 'raid' | 'sub';
  skillOptions?: ('ass' | 'raid' | 'sub')[];
  amount?: number;
  tokenName?: string;
  tokenOff?: number;
  tokenDef?: number;
  // For Deploy x card_type and Deploy any x keywords
  deployCardType?: 'Operative' | 'Location' | 'Support' | 'any';
  deployCount?: number;
  // For Exhaust keyword
  exhaustTargetType?: 'card' | 'operative' | 'location';
  exhaustCount?: number;
  // For modal choice (e.g. "+1 OFF or +1 DEF" or "Discard 1 from hand OR 2 in play")
  choices?: AtomicEffect[];
  choiceLabels?: string[];
  rawPhrase?: string;
}

export interface ParsedAbilityDefinition {
  id?: string;
  name?: string;
  trigger: AbilityTriggerType;
  requiresTap?: boolean;
  isPassive?: boolean; // Card does not Exhaust when using Special Ability
  requiresSacrifice?: boolean;
  isInterrupt?: boolean; // Can be played anytime, out of player's turn, even when not being attacked
  isIntercept?: boolean; // Can be deployed or use special ability out of turn when attacked with special ability or operation
  discardAtEndOfTurn?: boolean; // Automatically discarded at the end of the player's turn
  costCoins?: number;
  targetType: AbilityTargetType;
  effects: AtomicEffect[];
  canPlayOnDefense: boolean;
  rawText: string;
  isValid: boolean;
  recognizedKeywords: string[];
  unrecognizedText?: string;
  summary: string;
}

export class AbilityParserService {
  private static instance: AbilityParserService;

  public static getInstance(): AbilityParserService {
    if (!AbilityParserService.instance) {
      AbilityParserService.instance = new AbilityParserService();
    }
    return AbilityParserService.instance;
  }

  /**
   * Standardizes and tokenizes natural language / rule text into an executable ParsedAbilityDefinition
   */
  public parseAbility(text?: string, presetConfig?: any): ParsedAbilityDefinition {
    const raw = (text || '').trim();
    const recognizedKeywords: string[] = [];

    if (!raw && !presetConfig) {
      return {
        trigger: 'passive',
        targetType: 'none',
        effects: [],
        canPlayOnDefense: false,
        rawText: '',
        isValid: false,
        recognizedKeywords: [],
        summary: 'No special ability defined.'
      };
    }

    const lower = raw.toLowerCase();

    // 0. Detect Coin / Resource Payment Cost (Multi-Trigger or Cost Requirement)
    let costCoins = 0;
    const payMatch = lower.match(/(?:pay|costs?)\s*([0-9]+)\s*(?:coins?|resources?|spendables?)?\b/i);
    if (payMatch) {
      costCoins = parseInt(payMatch[1]);
      recognizedKeywords.push(`Pay ${costCoins} Resource(s)`);
    } else if (presetConfig?.costCoins) {
      costCoins = presetConfig.costCoins;
      recognizedKeywords.push(`Pay ${costCoins} Resource(s)`);
    }

    // 1. Detect Trigger & Multi-Trigger flags
    let requiresTap = false;
    let isPassive = false;
    let requiresSacrifice = false;
    let isInterrupt = false;
    let isIntercept = false;
    let discardAtEndOfTurn = false;
    let trigger: AbilityTriggerType = 'tap';

    const hasPassiveKeyword = lower.includes('passive');
    const hasTapKeyword = lower.startsWith('tap') || lower.includes('tap:') || lower.includes('tap,') || lower.match(/\btap\b/i);
    const hasSacrificeKeyword = lower.includes('sacrifice') || lower.includes('discard while in play');
    const hasDeployKeyword = lower.includes('when deployed') || lower.includes('on deploy') || lower.includes('on play') || lower.includes('enter the battlefield');
    const hasInterruptKeyword = lower.includes('interrupt');
    const hasInterceptKeyword = lower.includes('intercept') || lower.includes('reaction') || lower.includes('out-of-turn') || lower.includes('on defense') || lower.includes('defensive reaction');
    const hasDiscardEndTurn = lower.includes('discard at end of turn') || lower.includes('discard at the end of turn') || lower.includes('discard at end of your turn') || lower.includes('discard at end of player\'s turn') || lower.includes('discard at the end of the player\'s turn');

    if (hasDiscardEndTurn) {
      discardAtEndOfTurn = true;
      recognizedKeywords.push('Discard at end of turn');
    }

    if (hasInterruptKeyword) {
      isInterrupt = true;
      trigger = 'interrupt';
      recognizedKeywords.push('Interrupt (Play Anytime Out-of-Turn)');
    } else if (hasInterceptKeyword) {
      isIntercept = true;
      trigger = 'intercept';
      recognizedKeywords.push('Intercept (Play/Use Out-of-Turn When Attacked)');
    } else if (hasSacrificeKeyword) {
      trigger = 'sacrifice';
      requiresSacrifice = true;
      recognizedKeywords.push('Sacrifice');
      if (costCoins > 0) {
        recognizedKeywords.push(`Multi-Trigger: Sacrifice + Pay ${costCoins}`);
      }
    } else if (hasDeployKeyword) {
      trigger = 'deploy';
      recognizedKeywords.push('On Deploy');
      if (costCoins > 0) {
        recognizedKeywords.push(`Multi-Trigger: Deploy + Pay ${costCoins}`);
      }
    } else if (hasPassiveKeyword) {
      trigger = 'passive';
      isPassive = true;
      requiresTap = false;
      recognizedKeywords.push('Passive (No Exhaust)');
      if (costCoins > 0) {
        recognizedKeywords.push(`Multi-Trigger: Passive + Pay ${costCoins}`);
      }
    } else if (hasTapKeyword) {
      trigger = 'tap';
      requiresTap = true;
      isPassive = false;
      recognizedKeywords.push('Tap');
      if (costCoins > 0) {
        recognizedKeywords.push(`Multi-Trigger: Tap + Pay ${costCoins}`);
      }
    } else if (costCoins > 0) {
      trigger = 'pay_coins';
      isPassive = true; // "Pay x" without tap does not exhaust
      requiresTap = false;
      recognizedKeywords.push(`Pay ${costCoins} Trigger (Passive / No Exhaust)`);
    } else if (presetConfig?.trigger) {
      trigger = presetConfig.trigger;
      if (trigger === 'passive') isPassive = true;
      if (trigger === 'tap') requiresTap = true;
      if (trigger === 'interrupt') isInterrupt = true;
      if (trigger === 'intercept') isIntercept = true;
    } else {
      trigger = 'tap';
      requiresTap = true;
    }

    // 2. Detect Target Type
    let targetType: AbilityTargetType = 'none';
    if (lower.includes('all friendly') || lower.includes('each friendly')) {
      targetType = 'all_friendly_ops';
      recognizedKeywords.push('All Friendly Operatives');
    } else if (lower.includes('friendly op') || lower.includes('friendly operative') || lower.includes('target operative') || lower.includes('any operative')) {
      targetType = 'friendly_op';
      recognizedKeywords.push('Friendly Operative Target');
    } else if (lower.includes('enemy op') || lower.includes('enemy operative')) {
      targetType = 'enemy_op';
      recognizedKeywords.push('Enemy Operative Target');
    } else if (lower.includes('opponent') || lower.includes('enemy hand') || lower.includes('enemy battlefield')) {
      targetType = 'opponent';
      recognizedKeywords.push('Opponent Target');
    } else if (lower.includes('self') || lower.includes('this card')) {
      targetType = 'self';
      recognizedKeywords.push('Self Target');
    }

    // 3. Detect Atomic Effects
    const effects: AtomicEffect[] = [];

    // A. Assemble Strike or Defense Choice
    if (lower.includes('strike team') && lower.includes('defense team')) {
      recognizedKeywords.push('Assemble Strike / Defense Team');
      effects.push({
        type: 'choice',
        choices: [
          { type: 'buff_stat', stat: 'off', amount: 2, rawPhrase: 'Assemble Strike Team (+2 Offense)' },
          { type: 'buff_stat', stat: 'def', amount: 2, rawPhrase: 'Assemble Defense Team (+2 Defense)' }
        ],
        choiceLabels: ['Assemble Strike Team (+2 OFF)', 'Assemble Defense Team (+2 DEF)']
      });
    }

    // B. Buff Offense or Defense Choice
    else if (
      (lower.includes('+1 off') || lower.includes('+1 offense')) &&
      (lower.includes('+1 def') || lower.includes('+1 defense')) &&
      (lower.includes(' or ') || lower.includes('/'))
    ) {
      recognizedKeywords.push('Choice: +1 OFF or +1 DEF');
      effects.push({
        type: 'choice',
        choices: [
          { type: 'buff_stat', stat: 'off', amount: 1, rawPhrase: '+1 Offense' },
          { type: 'buff_stat', stat: 'def', amount: 1, rawPhrase: '+1 Defense' }
        ],
        choiceLabels: ['+1 Offense', '+1 Defense']
      });
      if (targetType === 'none') targetType = 'friendly_op';
    }

    // C. Single Stat Buff (OFF or DEF)
    else {
      const offMatch = lower.match(/\+?([1-9])\s*(off|offense)\b/i);
      if (offMatch) {
        const amt = parseInt(offMatch[1]);
        recognizedKeywords.push(`+${amt} Offense Buff`);
        effects.push({ type: 'buff_stat', stat: 'off', amount: amt });
        if (targetType === 'none') targetType = 'friendly_op';
      }

      const defMatch = lower.match(/\+?([1-9])\s*(def|defense)\b/i);
      if (defMatch) {
        const amt = parseInt(defMatch[1]);
        recognizedKeywords.push(`+${amt} Defense Buff`);
        effects.push({ type: 'buff_stat', stat: 'def', amount: amt });
        if (targetType === 'none') targetType = 'friendly_op';
      }
    }

    // D. +x/+x Tech Tokens (Token that buffs OFF and DEF by x)
    const techMatch = lower.match(/\+?\s*([0-9]+)\s*\/\s*\+?\s*([0-9]+)\s*tech(?:\s*token[s]?)?/i) 
      || lower.match(/\+?\s*([0-9]+)\s*tech(?:\s*token[s]?)?/i);
    if (techMatch) {
      const amt = parseInt(techMatch[1]);
      recognizedKeywords.push(`+${amt}/+${amt} Tech Token`);
      effects.push({
        type: 'grant_token',
        tokenType: 'tech',
        stat: 'both',
        amount: amt,
        rawPhrase: `+${amt}/+${amt} Tech Token`
      });
      if (targetType === 'none') targetType = 'friendly_op';
    }

    // E. Skill Tokens (+1 ASS, RAID, SUB or choice of any)
    if (lower.includes('skill token') || (lower.includes('subterfuge') && lower.includes('assassin') && lower.includes('raid')) || lower.includes('grant_skill_token')) {
      recognizedKeywords.push('Grant Skill Token (ASS / RAID / SUB)');
      effects.push({
        type: 'grant_token',
        skillOptions: ['ass', 'raid', 'sub'],
        amount: 1
      });
      if (targetType === 'none') targetType = 'friendly_op';
    } else {
      if (lower.match(/\+?1\s*(ass|assassin)\b/i)) {
        recognizedKeywords.push('+1 Assassin Token');
        effects.push({ type: 'grant_token', skill: 'ass', amount: 1 });
        if (targetType === 'none') targetType = 'friendly_op';
      }
      if (lower.match(/\+?1\s*(raid)\b/i)) {
        recognizedKeywords.push('+1 Raid Token');
        effects.push({ type: 'grant_token', skill: 'raid', amount: 1 });
        if (targetType === 'none') targetType = 'friendly_op';
      }
      if (lower.match(/\+?1\s*(sub|subterfuge)\b/i)) {
        recognizedKeywords.push('+1 Subterfuge Token');
        effects.push({ type: 'grant_token', skill: 'sub', amount: 1 });
        if (targetType === 'none') targetType = 'friendly_op';
      }
    }

    // E. Draw Cards
    const drawMatch = lower.match(/draw\s*([1-9])\s*card/i) || lower.match(/draw\s*a\s*card/i);
    if (drawMatch || presetConfig?.drawCount) {
      const amt = presetConfig?.drawCount || (drawMatch && drawMatch[1] ? parseInt(drawMatch[1]) : 1);
      recognizedKeywords.push(`Draw ${amt} Card(s)`);
      effects.push({ type: 'draw', amount: amt });
    }

    // F. Siphon / Steal Resources
    const siphonMatch = lower.match(/(siphon|steal)\s*([1-9])\s*(coin|resource)/i);
    if (siphonMatch || presetConfig?.siphonCoins) {
      const amt = presetConfig?.siphonCoins || (siphonMatch ? parseInt(siphonMatch[2]) : 1);
      recognizedKeywords.push(`Siphon ${amt} Coin(s)`);
      effects.push({ type: 'siphon', amount: amt });
      targetType = 'opponent';
    }

    // G. Discard from Hand or Discard from Play
    if (lower.includes('hand') && lower.includes('in play') && (lower.includes('discard') || lower.includes('or'))) {
      recognizedKeywords.push('Choice: Discard Hand OR Discard In-Play');
      effects.push({
        type: 'choice',
        choices: [
          { type: 'discard_hand', amount: 1, rawPhrase: 'Force discard 1 card from hand' },
          { type: 'discard_field', amount: 2, rawPhrase: 'Discard 2 cards in play' }
        ],
        choiceLabels: ['Discard 1 From Hand', 'Discard 2 Cards In Play']
      });
      targetType = 'opponent';
    } else {
      const handDiscardMatch = lower.match(/discard\s*([1-9])\s*(card[s]?\s*)?(from\s*)?(hand)/i);
      if (handDiscardMatch || presetConfig?.discardHandCount) {
        const amt = presetConfig?.discardHandCount || (handDiscardMatch ? parseInt(handDiscardMatch[1]) : 1);
        recognizedKeywords.push(`Force Discard ${amt} From Hand`);
        effects.push({ type: 'discard_hand', amount: amt });
        targetType = 'opponent';
      }

      const fieldDiscardMatch = lower.match(/discard\s*([1-9])\s*(card[s]?\s*)?(in\s*play|from\s*battlefield)/i);
      if (fieldDiscardMatch || presetConfig?.discardFieldCount) {
        const amt = presetConfig?.discardFieldCount || (fieldDiscardMatch ? parseInt(fieldDiscardMatch[1]) : 1);
        recognizedKeywords.push(`Discard ${amt} In Play`);
        effects.push({ type: 'discard_field', amount: amt });
        targetType = 'opponent';
      }
    }

    // H. Spawn Token Operative
    const spawnMatch = lower.match(/spawn\s*(a\s*)?([0-9])\/([0-9])\s*([a-z0-9\s]+?)\s*token/i);
    if (spawnMatch || lower.includes('shadow warrior token') || lower.includes('spawn_token')) {
      const off = spawnMatch ? parseInt(spawnMatch[2]) : 1;
      const def = spawnMatch ? parseInt(spawnMatch[3]) : 1;
      const name = spawnMatch ? spawnMatch[4].trim() : 'Shadow Warrior';
      recognizedKeywords.push(`Spawn ${off}/${def} ${name} Token`);
      effects.push({
        type: 'spawn_token',
        tokenOff: off,
        tokenDef: def,
        tokenName: `${name} Token`
      });
    }

    // I. Intercept Defense Reaction
    if (trigger === 'reaction_defense') {
      const defBonusMatch = lower.match(/\+?([1-9])\s*def\b/i);
      const bonus = defBonusMatch ? parseInt(defBonusMatch[1]) : 2;
      recognizedKeywords.push(`+${bonus} Defense Reaction`);
      effects.push({
        type: 'intercept_defense',
        amount: bonus
      });
    }

    // J. Produce Coins
    const prodMatch = lower.match(/produce\s*\+?([1-9])\s*coin/i);
    if (prodMatch) {
      const amt = parseInt(prodMatch[1]);
      recognizedKeywords.push(`Produce +${amt} Coins`);
      effects.push({ type: 'produce_coins', amount: amt });
    }

    // K. Deploy Card ("Deploy x card_type" or "Deploy any x" / "Deploy to deploy x card from hand")
    const parseNum = (val?: string): number => {
      if (!val) return 1;
      const v = val.toLowerCase().trim();
      if (v === 'a' || v === 'an' || v === 'one') return 1;
      if (v === 'two') return 2;
      if (v === 'three') return 3;
      const n = parseInt(v, 10);
      return isNaN(n) ? 1 : n;
    };

    const deployOpMatch = lower.match(/(?:deploy|put\s+into\s+play)\s+(?:to\s+deploy\s+)?([0-9]+|a|an|one|two|three)?\s*(?:card[s]?)?\s*(?:of\s*)?(?:an?\s*)?operative[s]?/i)
      || lower.match(/deploy\s+([0-9]+|a|an|one|two|three)?\s*operative[s]?/i);

    const deployLocMatch = lower.match(/(?:deploy|put\s+into\s+play)\s+(?:to\s+deploy\s+)?([0-9]+|a|an|one|two|three)?\s*(?:card[s]?)?\s*(?:of\s*)?(?:an?\s*)?location[s]?/i)
      || lower.match(/deploy\s+([0-9]+|a|an|one|two|three)?\s*location[s]?/i);

    const deploySupMatch = lower.match(/(?:deploy|put\s+into\s+play)\s+(?:to\s+deploy\s+)?([0-9]+|a|an|one|two|three)?\s*(?:card[s]?)?\s*(?:of\s*)?(?:an?\s*)?support[s]?/i)
      || lower.match(/deploy\s+([0-9]+|a|an|one|two|three)?\s*support[s]?/i);

    const deployAnyMatch = lower.match(/(?:deploy|put\s+into\s+play)\s+(?:to\s+deploy\s+)?any\s*([0-9]+|a|an|one|two|three)?\s*(?:card[s]?)?/i)
      || lower.match(/deploy\s+to\s+deploy\s*([0-9]+|a|an|one|two|three)?\s*card[s]?/i)
      || lower.match(/(?:deploy|put\s+into\s+play)\s*([0-9]+|a|an|one|two|three)?\s*card[s]?\s*(?:of\s*any\s*type\s*)?(?:from\s*(?:your\s*)?hand)/i);

    if (deployOpMatch) {
      const amt = parseNum(deployOpMatch[1]);
      recognizedKeywords.push(`Deploy ${amt} Operative Card(s) (Free)`);
      effects.push({
        type: 'deploy_card',
        deployCardType: 'Operative',
        deployCount: amt,
        amount: amt,
        rawPhrase: `Deploy ${amt} Operative card${amt > 1 ? 's' : ''} from hand`
      });
    } else if (deployLocMatch) {
      const amt = parseNum(deployLocMatch[1]);
      recognizedKeywords.push(`Deploy ${amt} Location Card(s) (Free)`);
      effects.push({
        type: 'deploy_card',
        deployCardType: 'Location',
        deployCount: amt,
        amount: amt,
        rawPhrase: `Deploy ${amt} Location card${amt > 1 ? 's' : ''} from hand`
      });
    } else if (deploySupMatch) {
      const amt = parseNum(deploySupMatch[1]);
      recognizedKeywords.push(`Deploy ${amt} Support Card(s) (Free)`);
      effects.push({
        type: 'deploy_card',
        deployCardType: 'Support',
        deployCount: amt,
        amount: amt,
        rawPhrase: `Deploy ${amt} Support card${amt > 1 ? 's' : ''} from hand`
      });
    } else if (deployAnyMatch) {
      const amt = parseNum(deployAnyMatch[1]);
      recognizedKeywords.push(`Deploy Any ${amt} Card(s) (Free)`);
      effects.push({
        type: 'deploy_card',
        deployCardType: 'any',
        deployCount: amt,
        amount: amt,
        rawPhrase: `Deploy any ${amt} card${amt > 1 ? 's' : ''} from hand`
      });
    }

    // L. Exhaust Keyword: put one or more of opponent's card to Exhaust condition
    // Examples: "Tap: Exhaust 1 opponent's card.", "Exhaust 2 opponent operatives", "Exhaust opponent's card"
    const exhaustMatch = lower.match(/(?:exhaust|put\s+(?:one\s+or\s+more\s+of\s+)?(?:opponent(?:'s)?\s+)?card[s]?\s+to\s+exhaust\s+condition)\s*([0-9]+|a|an|one|two|three)?\s*(?:of\s*)?(?:opponent(?:'s)?|enemy)?\s*(card[s]?|operative[s]?|location[s]?)?/i)
      || lower.match(/exhaust\s+([0-9]+|a|an|one|two|three)?\s*(?:of\s*)?(?:opponent(?:'s)?|enemy)?\s*(card[s]?|operative[s]?|location[s]?)?/i);

    if (exhaustMatch) {
      const amt = parseNum(exhaustMatch[1]);
      const targetWord = (exhaustMatch[2] || 'card').toLowerCase();
      const exType: 'card' | 'operative' | 'location' = targetWord.includes('op') ? 'operative' : targetWord.includes('loc') ? 'location' : 'card';
      recognizedKeywords.push(`Exhaust ${amt} Opponent ${exType.charAt(0).toUpperCase() + exType.slice(1)}(s)`);
      effects.push({
        type: 'exhaust_card',
        amount: amt,
        exhaustCount: amt,
        exhaustTargetType: exType,
        rawPhrase: `Exhaust ${amt} opponent's ${exType}${amt > 1 ? 's' : ''}`
      });
      targetType = 'opponent';
    }

    // M. Scan registered custom keywords
    try {
      const allKws = KeywordRegistryService.getInstance().getAllKeywords();
      for (const kw of allKws) {
        if (!kw.isBuiltIn && lower.includes(kw.keyword.toLowerCase())) {
          recognizedKeywords.push(`[Custom] ${kw.keyword}`);
        }
      }
    } catch {
      // Ignore in non-browser / headless context
    }

    const isValid = effects.length > 0 || isInterrupt || isIntercept || discardAtEndOfTurn;
    const canPlayOnDefense = trigger === 'reaction_defense' || trigger === 'intercept' || isIntercept || lower.includes('on defense') || !!presetConfig?.canPlayOnDefense;

    // Generate human-readable summary
    const summary = this.generateSummary(trigger, targetType, effects, canPlayOnDefense, costCoins, isPassive, requiresTap, isInterrupt, isIntercept, discardAtEndOfTurn);

    return {
      trigger,
      requiresTap,
      isPassive,
      requiresSacrifice,
      isInterrupt,
      isIntercept,
      discardAtEndOfTurn,
      costCoins: costCoins > 0 ? costCoins : undefined,
      targetType,
      effects,
      canPlayOnDefense,
      rawText: raw,
      isValid,
      recognizedKeywords: Array.from(new Set(recognizedKeywords)),
      summary
    };
  }

  /**
   * Generates standardized card rules text from structured ability settings
   */
  public generateStandardizedText(config: {
    trigger: AbilityTriggerType;
    targetType: AbilityTargetType;
    effects: AtomicEffect[];
    canPlayOnDefense?: boolean;
    costCoins?: number;
    isPassive?: boolean;
    discardAtEndOfTurn?: boolean;
  }): string {
    const parts: string[] = [];
    const hasCost = config.costCoins && config.costCoins > 0;
    const costStr = hasCost ? `Pay ${config.costCoins} coin${config.costCoins! > 1 ? 's' : ''}` : '';

    // 1. Trigger prefix
    switch (config.trigger) {
      case 'tap':
        parts.push(hasCost ? `Tap, ${costStr}:` : 'Tap:');
        break;
      case 'passive':
        parts.push(hasCost ? `Passive, ${costStr}:` : 'Passive:');
        break;
      case 'sacrifice':
        parts.push(hasCost ? `Sacrifice, ${costStr}:` : 'Sacrifice:');
        break;
      case 'pay_coins':
        parts.push(hasCost ? `${costStr}:` : 'Pay 1 coin:');
        break;
      case 'deploy':
        parts.push(hasCost ? `On Deploy, ${costStr}:` : 'On Deploy:');
        break;
      case 'reaction_defense':
        parts.push(hasCost ? `Intercept Reaction, ${costStr}:` : 'Intercept Reaction:');
        break;
      case 'intercept':
        parts.push(hasCost ? `Intercept, ${costStr}:` : 'Intercept:');
        break;
      case 'interrupt':
        parts.push(hasCost ? `Interrupt, ${costStr}:` : 'Interrupt:');
        break;
    }

    // 3. Target phrasing
    let targetStr = '';
    switch (config.targetType) {
      case 'friendly_op':
        targetStr = 'give target friendly operative';
        break;
      case 'enemy_op':
        targetStr = 'target enemy operative';
        break;
      case 'opponent':
        targetStr = 'force Opponent to';
        break;
      case 'all_friendly_ops':
        targetStr = 'all friendly operatives gain';
        break;
      default:
        targetStr = '';
        break;
    }

    // 4. Effects phrasing
    const effectPhrases: string[] = [];
    for (const eff of config.effects) {
      if (eff.type === 'choice' && eff.choices) {
        const cLabels = eff.choiceLabels || eff.choices.map(c => c.rawPhrase || c.type);
        effectPhrases.push(`Choose one: ${cLabels.join(' OR ')}`);
      } else if (eff.type === 'buff_stat') {
        effectPhrases.push(`+${eff.amount || 1} ${eff.stat === 'off' ? 'Offense' : 'Defense'}`);
      } else if (eff.type === 'grant_token') {
        if (eff.tokenType === 'tech' || eff.stat === 'both') {
          effectPhrases.push(`+${eff.amount || 1}/+${eff.amount || 1} Tech token`);
        } else if (eff.skillOptions && eff.skillOptions.length > 1) {
          effectPhrases.push('grant +1 SUB, ASS, or RAID skill token');
        } else {
          effectPhrases.push(`grant +1 ${(eff.skill || 'ass').toUpperCase()} token`);
        }
      } else if (eff.type === 'draw') {
        effectPhrases.push(`draw ${eff.amount || 1} card${(eff.amount || 1) > 1 ? 's' : ''}`);
      } else if (eff.type === 'siphon') {
        effectPhrases.push(`siphon ${eff.amount || 1} coin${(eff.amount || 1) > 1 ? 's' : ''} from Opponent`);
      } else if (eff.type === 'discard_hand') {
        effectPhrases.push(`discard ${eff.amount || 1} card${(eff.amount || 1) > 1 ? 's' : ''} from hand`);
      } else if (eff.type === 'discard_field') {
        effectPhrases.push(`discard ${eff.amount || 1} card${(eff.amount || 1) > 1 ? 's' : ''} in play`);
      } else if (eff.type === 'spawn_token') {
        effectPhrases.push(`spawn a ${eff.tokenOff || 1}/${eff.tokenDef || 1} ${eff.tokenName || 'Operative'} token`);
      } else if (eff.type === 'intercept_defense') {
        effectPhrases.push(`fortify defense by +${eff.amount || 2} DEF during attack interception`);
      } else if (eff.type === 'produce_coins') {
        effectPhrases.push(`produce +${eff.amount || 1} coins`);
      } else if (eff.type === 'deploy_card') {
        const cnt = eff.deployCount || eff.amount || 1;
        if (eff.deployCardType === 'any' || !eff.deployCardType) {
          effectPhrases.push(`deploy any ${cnt} card${cnt > 1 ? 's' : ''} from your hand without paying card cost`);
        } else {
          effectPhrases.push(`deploy ${cnt} ${eff.deployCardType} card${cnt > 1 ? 's' : ''} from your hand without paying card cost`);
        }
      } else if (eff.type === 'exhaust_card') {
        const cnt = eff.exhaustCount || eff.amount || 1;
        const targetTypeLabel = eff.exhaustTargetType ? `${eff.exhaustTargetType}` : "card";
        effectPhrases.push(`exhaust ${cnt} opponent's ${targetTypeLabel}${cnt > 1 ? 's' : ''}`);
      }
    }

    const effectStr = effectPhrases.join(', ');
    if (targetStr && !effectStr.startsWith('Choose one:') && !effectStr.startsWith('exhaust')) {
      parts.push(`${targetStr} ${effectStr}.`);
    } else {
      parts.push(`${effectStr}.`);
    }

    if (config.canPlayOnDefense && config.trigger !== 'reaction_defense' && config.trigger !== 'intercept') {
      parts.push('Can also be played out-of-turn on defense.');
    }

    if (config.discardAtEndOfTurn) {
      parts.push('Discard at end of turn.');
    }

    return parts.join(' ');
  }

  private generateSummary(
    trigger: AbilityTriggerType,
    targetType: AbilityTargetType,
    effects: AtomicEffect[],
    canPlayOnDefense: boolean,
    costCoins?: number,
    isPassive?: boolean,
    requiresTap?: boolean,
    isInterrupt?: boolean,
    isIntercept?: boolean,
    discardAtEndOfTurn?: boolean
  ): string {
    if (effects.length === 0 && !isInterrupt && !isIntercept && !discardAtEndOfTurn) {
      return 'Passive or unmodeled card text.';
    }

    const costText = costCoins && costCoins > 0 ? ` + Pay ${costCoins} Coin${costCoins > 1 ? 's' : ''}` : '';

    let triggerLabel = '';
    if (trigger === 'interrupt' || isInterrupt) {
      triggerLabel = `⚡ Interrupt (Play Anytime Out-of-Turn)${costText}`;
    } else if (trigger === 'intercept' || isIntercept) {
      triggerLabel = `🛡️ Intercept (Play Out-of-Turn When Attacked)${costText}`;
    } else if (trigger === 'tap' && costCoins) {
      triggerLabel = `⚡💰 Multi-Trigger: Tap + Pay ${costCoins} Coin${costCoins > 1 ? 's' : ''}`;
    } else if (trigger === 'tap') {
      triggerLabel = '⚡ Tap (In Play)';
    } else if (trigger === 'passive' && costCoins) {
      triggerLabel = `⚙️💰 Multi-Trigger: Passive (No Exhaust) + Pay ${costCoins} Coin${costCoins > 1 ? 's' : ''}`;
    } else if (trigger === 'passive') {
      triggerLabel = '⚙️ Passive (No Exhaust)';
    } else if (trigger === 'pay_coins') {
      triggerLabel = `💰 Pay ${costCoins || 1} Coin${(costCoins || 1) > 1 ? 's' : ''} (Passive / No Exhaust)`;
    } else if (trigger === 'sacrifice' && costCoins) {
      triggerLabel = `🔥💰 Multi-Trigger: Sacrifice + Pay ${costCoins} Coin${costCoins > 1 ? 's' : ''}`;
    } else if (trigger === 'sacrifice') {
      triggerLabel = '🔥 Sacrifice (From Play)';
    } else if (trigger === 'deploy') {
      triggerLabel = `✨ When Deployed${costText}`;
    } else if (trigger === 'reaction_defense') {
      triggerLabel = `🛡️ Intercept Reaction${costText}`;
    } else {
      triggerLabel = isPassive ? '⚙️ Passive (No Exhaust)' : 'Special Ability';
    }

    const targetLabel =
      targetType === 'friendly_op' ? 'Friendly Op' :
      targetType === 'enemy_op' ? 'Enemy Op' :
      targetType === 'opponent' ? 'Opponent' :
      targetType === 'all_friendly_ops' ? 'All Friendly Ops' : 'Self / Game State';

    const effectSummary = effects.map(e => {
      if (e.type === 'choice') return `Choice [${e.choiceLabels?.join(' / ')}]`;
      if (e.type === 'buff_stat') return `+${e.amount} ${e.stat?.toUpperCase()}`;
      if (e.type === 'grant_token') {
        if (e.tokenType === 'tech' || e.stat === 'both') {
          return `+${e.amount}/+${e.amount} Tech Token`;
        }
        return `+${e.amount} Token`;
      }
      if (e.type === 'draw') return `Draw ${e.amount}`;
      if (e.type === 'siphon') return `Siphon ${e.amount}`;
      if (e.type === 'discard_hand') return `Opponent Discard Hand (${e.amount})`;
      if (e.type === 'discard_field') return `Opponent Discard Field (${e.amount})`;
      if (e.type === 'spawn_token') return `Spawn ${e.tokenName}`;
      if (e.type === 'intercept_defense') return `+${e.amount} DEF Intercept`;
      if (e.type === 'deploy_card') {
        const cnt = e.deployCount || e.amount || 1;
        const target = e.deployCardType === 'any' || !e.deployCardType ? 'Any' : e.deployCardType;
        return `Deploy ${cnt} ${target} (Free)`;
      }
      if (e.type === 'exhaust_card') {
        const cnt = e.exhaustCount || e.amount || 1;
        return `Exhaust (${cnt} Opponent Card${cnt > 1 ? 's' : ''})`;
      }
      return e.type;
    }).join(' + ');

    const endTurnTag = discardAtEndOfTurn ? ' | ⏳ Discard at end of turn' : '';

    return `[${triggerLabel}] -> [Target: ${targetLabel}] -> ${effectSummary || 'Keyword effect'}${endTurnTag}`;
  }
}
