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
    description: 'Player must deduct x resources (Spendables) to trigger the ability. Action is disabled if Spendables < x.',
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
    description: 'Card does not Exhaust when using Special Ability. Can be activated without tapping.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Passive: Pay 1 coin: Give target friendly operative +1/+1 Tech token.'
  },
  {
    id: 'kw_tap',
    keyword: 'Tap',
    category: 'trigger',
    syntaxTemplate: 'Tap:',
    description: 'Card exhausts (E) when activating this ability. Cannot be used while already exhausted.',
    isBuiltIn: true,
    parameterType: 'none',
    sampleUsage: 'Tap: Give target friendly operative +1 OFF.'
  },
  {
    id: 'kw_tap_pay',
    keyword: 'Tap, Pay x',
    category: 'trigger',
    syntaxTemplate: 'Tap, Pay {x} coins:',
    description: 'Multi-trigger: Card exhausts (E) AND player pays x resources to activate.',
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
    description: 'Multi-trigger: Player pays x resources. Card DOES NOT exhaust.',
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
    description: 'Token that buffs both Offense (OFF) and Defense (DEF) by x. x can be 1, 2, 3, or more.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: Give target friendly operative +1/+1 Tech token.'
  },
  {
    id: 'kw_skill_token_any',
    keyword: 'Grant Skill Token',
    category: 'token',
    syntaxTemplate: 'grant +1 SUB, ASS, or RAID token',
    description: 'Grants +1 Subterfuge, Assassin, or Raid skill token to target operative.',
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
    keyword: 'Discard Hand x',
    category: 'effect',
    syntaxTemplate: 'force Opponent to discard {x} card(s) from hand',
    description: 'Forces opponent to discard x cards from their hand.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 1,
    sampleUsage: 'Tap: force Opponent to discard 1 card from hand.'
  },
  {
    id: 'kw_discard_field',
    keyword: 'Discard In-Play x',
    category: 'effect',
    syntaxTemplate: 'discard {x} opponent card(s) in play',
    description: 'Removes and discards x cards from opponent battlefield.',
    isBuiltIn: true,
    parameterType: 'number',
    defaultParamValue: 2,
    sampleUsage: 'Sacrifice: discard 2 opponent cards in play.'
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
