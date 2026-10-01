/**
 * KeywordRegistryService
 * Dynamic Registry for Built-in and User-Defined Keywords in Spywar Action Studio
 */

export type KeywordCategory = 'trigger' | 'cost' | 'token' | 'effect' | 'modifier' | 'target';

export interface KeywordDefinition {
  id: string;
  keyword: string; // e.g. "Pay x", "+x/+x Tech", "Passive", "Tap", "Sacrifice"
  category: KeywordCategory;
  syntaxTemplate: string; // e.g. "Pay {x} coin(s):", "+{x}/+{x} Tech token", "Passive:"
  description: string;
  isBuiltIn: boolean;
  parameterType?: 'number' | 'text' | 'none';
  defaultParamValue?: number;
  sampleUsage?: string;
}

export const BUILT_IN_KEYWORDS: KeywordDefinition[] = [
  // 1. Triggers & Costs
  {
    id: 'kw_pay_x',
    keyword: 'Pay x',
    category: 'cost',
    syntaxTemplate: 'Pay {x} coins:',
    description: "Player must deduct x resources (Spendables) to trigger the ability. Action is disabled if Spendables < x. NOTE: Under standard rules, using any special ability exhausts/taps the card (limiting it to once per turn) unless marked as Passive.",
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Pay 2 coins: Draw 1 card.'
  },
  {
    id: 'kw_passive',
    keyword: 'Passive',
    category: 'trigger',
    syntaxTemplate: 'Passive:',
    description: 'Card does not need to tap or exhaust to use its special ability. Thus, the Passive ability can be used more than once per turn (as long as conditions/costs are met). All other special abilities exhaust the card, limiting them to once per turn.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Passive: Pay 1 coin: Give target friendly operative +1/+1 Tech token.'
  },
  {
    id: 'kw_tap',
    keyword: 'Tap',
    category: 'trigger',
    syntaxTemplate: 'Tap:',
    description: 'Card exhausts (E) when activating this ability, limiting it to once per turn. Cannot be used while already exhausted.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Give target friendly operative +1 OFF.'
  },
  {
    id: 'kw_tap_pay',
    keyword: 'Tap, Pay x',
    category: 'trigger',
    syntaxTemplate: 'Tap, Pay {x} coins:',
    description: 'Multi-trigger: Card exhausts (E) AND player pays x resources to activate (limits special ability to once per turn).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap, Pay 1 coin: Grant +1 RAID token to friendly operative.'
  },
  {
    id: 'kw_passive_pay',
    keyword: 'Passive, Pay x',
    category: 'trigger',
    syntaxTemplate: 'Passive, Pay {x} coins:',
    description: 'Multi-trigger: Player pays x resources. Card DOES NOT exhaust (Passive), allowing the ability to be used more than once per turn as long as player has sufficient resources.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Passive, Pay 2 coins: Draw 1 card.'
  },
  {
    id: 'kw_sacrifice',
    keyword: 'Sacrifice',
    category: 'trigger',
    syntaxTemplate: 'Sacrifice:',
    description: 'Card is discarded from the battlefield to the discard pile upon activation.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Sacrifice: Discard 1 card from hand or 2 cards in play.'
  },
  {
    id: 'kw_on_deploy',
    keyword: 'On Deploy',
    category: 'trigger',
    syntaxTemplate: 'On Deploy:',
    description: 'Triggers immediately when the card is played onto the battlefield.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'On Deploy: Siphon 2 coins from Opponent.'
  },
  {
    id: 'kw_intercept_reaction',
    keyword: 'Intercept Reaction',
    category: 'trigger',
    syntaxTemplate: 'Intercept Reaction:',
    description: 'Can be played out-of-turn as an instant reaction during attack defense.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Intercept Reaction: Fortify defense by +2 DEF during attack interception.'
  },

  // 2. Tokens & Buffs
  {
    id: 'kw_tech_token',
    keyword: '+x/+x Tech',
    category: 'token',
    syntaxTemplate: '+{x}/+{x} Tech token',
    description: 'Token that buffs both Offense (OFF) and Defense (DEF) by x. Operatives can receive at most 1 Tech token (duplicate tokens cannot be stacked).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Tech token.'
  },
  {
    id: 'kw_weapon_token',
    keyword: '+x/+x Weapon token',
    category: 'token',
    syntaxTemplate: '+{x}/+{x} Weapon token',
    description: 'Token that buffs both Offense (OFF) and Defense (DEF) by x. Operatives can receive at most 1 Weapon token (duplicate tokens cannot be stacked).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Weapon token.'
  },
  {
    id: 'kw_suit_token',
    keyword: '+x/+x Suit token',
    category: 'token',
    syntaxTemplate: '+{x}/+{x} Suit token',
    description: 'Token that buffs both Offense (OFF) and Defense (DEF) by x. Operatives can receive at most 1 Suit token (duplicate tokens cannot be stacked).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Suit token.'
  },
  {
    id: 'kw_power_armor_token',
    keyword: '+x/+x Power Armor token',
    category: 'token',
    syntaxTemplate: '+{x}/+{x} Power Armor token',
    description: 'Token that gives 1 or more points bonus to both Offense (OFF) and Defense (DEF) by x. Operatives can receive at most 1 Power Armor token (duplicate tokens cannot be stacked).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Power Armor token.'
  },
  {
    id: 'kw_powered_armor_token',
    keyword: '+x/+x Powered armor token',
    category: 'token',
    syntaxTemplate: '+{x}/+{x} Powered armor token',
    description: 'Alias for Power Armor token. Token that buffs both Offense (OFF) and Defense (DEF) by x. Operatives can receive at most 1 Power Armor token (duplicate tokens cannot be stacked).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Powered armor token.'
  },
  {
    id: 'kw_power_suit_token',
    keyword: '+x/+x Power Suit token',
    category: 'token',
    syntaxTemplate: '+{x}/+{x} Power Suit token',
    description: 'Token that buffs both Offense (OFF) and Defense (DEF) by x. Operatives can receive at most 1 Power Suit token (duplicate tokens cannot be stacked).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Power Suit token.'
  },
  {
    id: 'kw_discard_token',
    keyword: 'Discard token',
    category: 'token',
    syntaxTemplate: 'Discard token',
    description: "Placed on top of a card. A card with a Discard token is discarded at end of player's turn. Duplicate Discard tokens cannot be stacked.",
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Place Discard token on target card in play.'
  },
  {
    id: 'kw_skill_token_any',
    keyword: 'Grant Skill Token',
    category: 'token',
    syntaxTemplate: 'grant +1 SUB, ASS, or RAID token',
    description: 'Grants +1 Subterfuge, Assassin, or Raid skill token to target operative. If an operative already has that skill, it can no longer receive that skill token.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: grant +1 SUB, ASS, or RAID skill token.'
  },
  {
    id: 'kw_buff_off',
    keyword: '+x OFF',
    category: 'token',
    syntaxTemplate: '+{x} OFF',
    description: 'Grants temporary Offense buff to operative until end of round.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1 OFF.'
  },
  {
    id: 'kw_buff_def',
    keyword: '+x DEF',
    category: 'token',
    syntaxTemplate: '+{x} DEF',
    description: 'Grants temporary Defense buff to operative until end of round.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1 DEF.'
  },

  // 3. Effects
  {
    id: 'kw_draw',
    keyword: 'Draw x',
    category: 'effect',
    syntaxTemplate: 'draw {x} card(s)',
    description: 'Draws x cards from deck into hand.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: draw 1 card.'
  },
  {
    id: 'kw_siphon',
    keyword: 'Siphon x',
    category: 'effect',
    syntaxTemplate: 'siphon {x} coins from Opponent',
    description: 'Steals x resources from opponent spendables into active player turn coins.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 2,
    sampleUsage: 'Tap: siphon 2 coins from Opponent.'
  },
  {
    id: 'kw_discard_hand',
    keyword: 'Discard x card from hand',
    category: 'effect',
    syntaxTemplate: 'discard {x} card(s) from hand',
    description: 'Forces opponent to discard 1 or more cards from their hand.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: discard 1 card from hand.'
  },
  {
    id: 'kw_discard_field',
    keyword: 'Discard x card in play',
    category: 'effect',
    syntaxTemplate: 'discard {x} card(s) in play',
    description: 'Forces opponent to discard 1 or more cards in play.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: discard 1 card in play.'
  },
  {
    id: 'kw_gain_resource',
    keyword: 'Gain x resource',
    category: 'effect',
    syntaxTemplate: 'gain {x} resource(s)',
    description: 'Player gains x spendable resources (turn coins).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: gain 2 resources.'
  },
  {
    id: 'kw_gain_resource_equal_discard',
    keyword: 'Gain x resource equal to discarded card cost',
    category: 'effect',
    syntaxTemplate: 'gain resource equal to discarded card cost',
    description: 'After tapping and discarding a card from hand, Player gains Spendable resources equal to the discarded card\'s printed cost.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Discards 1 card from hand, gain x resource equal to discarded card.'
  },
  {
    id: 'kw_spawn_token',
    keyword: 'Spawn Token',
    category: 'effect',
    syntaxTemplate: 'spawn a 1/1 Shadow Warrior token',
    description: 'Deploys a token operative unit onto the friendly battlefield.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: spawn a 1/1 Shadow Warrior token.'
  },
  {
    id: 'kw_deploy_card_type',
    keyword: 'Deploy x card_type',
    category: 'effect',
    syntaxTemplate: 'Deploy {x} Operative card(s) from your hand',
    description: 'Allows the player to put into play 1 or more cards from hand of a particular card type without paying the card cost (Support, Operative, or Location).',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Deploy 2 Operative cards from your hand.'
  },
  {
    id: 'kw_deploy_any',
    keyword: 'Deploy any x',
    category: 'effect',
    syntaxTemplate: 'Deploy any {x} card(s) from your hand',
    description: 'Allows the player to put into play 1 or more cards of any card type from hand without paying the card cost.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Deploy to deploy 1 card from hand.'
  },
  {
    id: 'kw_exhaust',
    keyword: 'Exhaust',
    category: 'effect',
    syntaxTemplate: 'Exhaust {x} opponent card(s)',
    description: "Put one or more of opponent's card to Exhaust condition to prevent it from using its resource production or special abilities.",
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: "Tap: Exhaust 1 opponent's card."
  },
  {
    id: 'kw_intercept',
    keyword: 'Intercept',
    category: 'trigger',
    syntaxTemplate: 'Intercept:',
    description: "Card with Intercept can be deployed or use its special ability out of turn when attacked with a card's special ability or Operation. Using an Intercept special ability automatically Exhausts or Taps the card as well, limiting its use to once per turn, unless it also has Passive special ability.",
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Intercept: Fortify defense by +2 DEF against incoming threat or special ability attack.'
  },
  {
    id: 'kw_interrupt',
    keyword: 'Interrupt',
    category: 'trigger',
    syntaxTemplate: 'Interrupt:',
    description: "A card with an Interrupt can be played anytime, out of player's turn, even when not being attacked. Using an Interrupt special ability automatically Exhausts or Taps the card as well, limiting its use to once per turn, unless it also has Passive special ability.",
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Interrupt: Exhaust 1 opponent card in play.'
  },
  {
    id: 'kw_discard_end_turn',
    keyword: 'Discard at end of turn',
    category: 'modifier',
    syntaxTemplate: 'Discard at end of turn.',
    description: "Cards with this keyword are automatically discarded at the end of the player's turn.",
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Deploy: +2 OFF to target operative. Discard at end of turn.'
  },
  {
    id: 'kw_cost_discount_op',
    keyword: 'Operative cost x less resource to deploy',
    category: 'effect',
    syntaxTemplate: 'Operative cost {x} less resource to deploy.',
    description: 'Passive discount: Player gets a discount of x resource(s) every time they deploy an Operative card (minimum 0). Does not require tapping.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Passive: Operative cost 1 less resource to deploy.'
  },

  // 4. Modifiers, Durations & Conditions
  {
    id: 'kw_temporary',
    keyword: 'Temporary',
    category: 'modifier',
    syntaxTemplate: 'Temporary: Selected Operative gains +{x} OFF until end of turn.',
    description: "Benefits marked as temporary last only as long as specified in the special ability description. Example, Selected Operative gain +1 OFF until end of turn. This means an Operative with 2 OFF becomes 3 OFF, but reverts back to 2 OFF after the player's turn.",
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Temporary: Selected Operative gains +1 OFF until end of turn.'
  },
  {
    id: 'kw_until_end_of_turn',
    keyword: 'Until end of turn',
    category: 'modifier',
    syntaxTemplate: 'until end of turn',
    description: "Specifies how long the bonus will last. Example, Selected Operative gain +1 OFF until end of turn. Operative with 2 OFF becomes 3 OFF, but reverts back to 2 OFF after the player's turn.",
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Selected Operative gains +1 OFF until end of turn.'
  },
  {
    id: 'kw_for_one_operation',
    keyword: 'For one operation',
    category: 'modifier',
    syntaxTemplate: 'for one operation',
    description: 'Benefit can be used, or lasts until it is used in any of the three operations (Subterfuge, Assassination, or Raid). Once used in an operation, the benefit expires.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Selected Operative gains +1 OFF for one operation.'
  },
  {
    id: 'kw_when_defending',
    keyword: 'when defending',
    category: 'modifier',
    syntaxTemplate: 'when defending',
    description: 'Benefit can only be used when defending against an enemy operation.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Selected Operative gains +2 DEF when defending.'
  },
  {
    id: 'kw_for_1_turn',
    keyword: 'For 1 turn',
    category: 'modifier',
    syntaxTemplate: 'for 1 turn',
    description: 'Similar to end of turn. Specifies how long the bonus will last; reverts back after 1 turn.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Target operative gains +1 DEF for 1 turn.'
  },
  {
    id: 'kw_or_choice',
    keyword: 'or',
    category: 'modifier',
    syntaxTemplate: '{Ability A} or {Ability B}',
    description: 'Player must select which special ability to activate. Example, Tap: Give Operative +2 OFF or +2 DEF for 1 turn.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Give Operative +2 OFF or +2 DEF for 1 turn.'
  }
];

const STORAGE_KEY = 'spywar_custom_keywords';

export class KeywordRegistryService {
  private static instance: KeywordRegistryService;
  private customKeywords: KeywordDefinition[] = [];

  private constructor() {
    this.loadCustomKeywords();
  }

  public static getInstance(): KeywordRegistryService {
    if (!KeywordRegistryService.instance) {
      KeywordRegistryService.instance = new KeywordRegistryService();
    }
    return KeywordRegistryService.instance;
  }

  private loadCustomKeywords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.customKeywords = JSON.parse(saved);
      }
    } catch {
      this.customKeywords = [];
    }
  }

  private saveCustomKeywords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customKeywords));
    } catch (e) {
      console.warn('Failed to persist custom keywords to localStorage', e);
    }
  }

  public getAllKeywords(): KeywordDefinition[] {
    return [...BUILT_IN_KEYWORDS, ...this.customKeywords];
  }

  public getKeywordsByCategory(category: KeywordCategory): KeywordDefinition[] {
    return this.getAllKeywords().filter(kw => kw.category === category);
  }

  public addCustomKeyword(kw: Omit<KeywordDefinition, 'id' | 'isBuiltIn'>): KeywordDefinition {
    const id = `custom_kw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newKw: KeywordDefinition = {
      ...kw,
      id,
      isBuiltIn: false
    };
    this.customKeywords.push(newKw);
    this.saveCustomKeywords();
    return newKw;
  }

  public deleteCustomKeyword(id: string): boolean {
    const idx = this.customKeywords.findIndex(kw => kw.id === id);
    if (idx !== -1) {
      this.customKeywords.splice(idx, 1);
      this.saveCustomKeywords();
      return true;
    }
    return false;
  }

  public resetCustomKeywords() {
    this.customKeywords = [];
    this.saveCustomKeywords();
  }

  /**
   * Generates a concrete chip phrase from a template and value
   */
  public generatePhrase(kw: KeywordDefinition, paramVal?: number): string {
    if (kw.parameterType === 'number') {
      const val = paramVal !== undefined ? paramVal : (kw.defaultParamValue ?? 1);
      return kw.syntaxTemplate.replace(/\{x\}/g, String(val));
    }
    return kw.syntaxTemplate;
  }
}
