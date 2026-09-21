/**
 * AbilityParserService
 * Standardized Keyword Syntax Interpreter and Engine Action Rule Compiler for Spywar
 */

export type AbilityTriggerType = 
  | 'tap' 
  | 'sacrifice' 
  | 'deploy' 
  | 'reaction_defense' 
  | 'passive';

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
  | 'choice';

export interface AtomicEffect {
  type: AtomicEffectType;
  stat?: 'off' | 'def' | 'both';
  skill?: 'ass' | 'raid' | 'sub';
  skillOptions?: ('ass' | 'raid' | 'sub')[];
  amount?: number;
  tokenName?: string;
  tokenOff?: number;
  tokenDef?: number;
  // For modal choice (e.g. "+1 OFF or +1 DEF" or "Discard 1 from hand OR 2 in play")
  choices?: AtomicEffect[];
  choiceLabels?: string[];
  rawPhrase?: string;
}

export interface ParsedAbilityDefinition {
  id?: string;
  name?: string;
  trigger: AbilityTriggerType;
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

    // 1. Detect Trigger
    let trigger: AbilityTriggerType = 'tap';
    if (lower.includes('intercept') || lower.includes('reaction') || lower.includes('out-of-turn') || lower.includes('on defense') || lower.includes('defensive reaction')) {
      trigger = 'reaction_defense';
      recognizedKeywords.push('Reaction / Intercept');
    } else if (lower.includes('sacrifice') || lower.includes('discard while in play')) {
      trigger = 'sacrifice';
      recognizedKeywords.push('Sacrifice');
    } else if (lower.includes('when deployed') || lower.includes('on deploy') || lower.includes('on play') || lower.includes('enter the battlefield')) {
      trigger = 'deploy';
      recognizedKeywords.push('On Deploy');
    } else if (lower.includes('passive') || lower.includes('cost 1 fewer') || lower.includes('discount')) {
      trigger = 'passive';
      recognizedKeywords.push('Passive');
    } else if (lower.includes('tap') || lower.includes('exhaust')) {
      trigger = 'tap';
      recognizedKeywords.push('Tap / Exhaust');
    } else if (presetConfig?.trigger) {
      trigger = presetConfig.trigger;
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

    // D. Skill Tokens (+1 ASS, RAID, SUB or choice of any)
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

    const isValid = effects.length > 0;
    const canPlayOnDefense = trigger === 'reaction_defense' || lower.includes('on defense') || !!presetConfig?.canPlayOnDefense;

    // Generate human-readable summary
    const summary = this.generateSummary(trigger, targetType, effects, canPlayOnDefense);

    return {
      trigger,
      targetType,
      effects,
      canPlayOnDefense,
      rawText: raw,
      isValid,
      recognizedKeywords,
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
  }): string {
    const parts: string[] = [];

    // 1. Trigger prefix
    switch (config.trigger) {
      case 'tap':
        parts.push('Tap:');
        break;
      case 'sacrifice':
        parts.push('Sacrifice:');
        break;
      case 'deploy':
        parts.push('On Deploy:');
        break;
      case 'reaction_defense':
        parts.push('Intercept Reaction:');
        break;
      case 'passive':
        parts.push('Passive:');
        break;
    }

    // 2. Cost if any
    if (config.costCoins && config.costCoins > 0) {
      parts.push(`Pay ${config.costCoins} coin${config.costCoins > 1 ? 's' : ''},`);
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
        if (eff.skillOptions && eff.skillOptions.length > 1) {
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
      }
    }

    const effectStr = effectPhrases.join(', ');
    if (targetStr && !effectStr.startsWith('Choose one:')) {
      parts.push(`${targetStr} ${effectStr}.`);
    } else {
      parts.push(`${effectStr}.`);
    }

    if (config.canPlayOnDefense && config.trigger !== 'reaction_defense') {
      parts.push('Can also be played out-of-turn on defense.');
    }

    return parts.join(' ');
  }

  private generateSummary(
    trigger: AbilityTriggerType,
    targetType: AbilityTargetType,
    effects: AtomicEffect[],
    canPlayOnDefense: boolean
  ): string {
    if (effects.length === 0) {
      return 'Passive or unmodeled card text.';
    }

    const triggerLabel = 
      trigger === 'tap' ? '⚡ Tap (In Play)' :
      trigger === 'sacrifice' ? '🔥 Sacrifice (From Play)' :
      trigger === 'deploy' ? '✨ When Deployed' :
      trigger === 'reaction_defense' ? '🛡️ Intercept Reaction' : 'Passive';

    const targetLabel =
      targetType === 'friendly_op' ? 'Friendly Op' :
      targetType === 'enemy_op' ? 'Enemy Op' :
      targetType === 'opponent' ? 'Opponent' :
      targetType === 'all_friendly_ops' ? 'All Friendly Ops' : 'Self / Game State';

    const effectSummary = effects.map(e => {
      if (e.type === 'choice') return `Choice [${e.choiceLabels?.join(' / ')}]`;
      if (e.type === 'buff_stat') return `+${e.amount} ${e.stat?.toUpperCase()}`;
      if (e.type === 'grant_token') return `+${e.amount} Token`;
      if (e.type === 'draw') return `Draw ${e.amount}`;
      if (e.type === 'siphon') return `Siphon ${e.amount}`;
      if (e.type === 'discard_hand') return `Opponent Discard Hand (${e.amount})`;
      if (e.type === 'discard_field') return `Opponent Discard Field (${e.amount})`;
      if (e.type === 'spawn_token') return `Spawn ${e.tokenName}`;
      if (e.type === 'intercept_defense') return `+${e.amount} DEF Intercept`;
      return e.type;
    }).join(' + ');

    return `[${triggerLabel}] -> [Target: ${targetLabel}] -> ${effectSummary}`;
  }
}
