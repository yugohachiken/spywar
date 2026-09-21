export type AbilityTrigger = 'activated_tap' | 'on_play' | 'sacrifice' | 'reaction_defense' | 'passive';
export type AbilityCategory = 'Operative' | 'Location' | 'Affiliation' | 'Support' | 'Universal';

export interface AbilityConfig {
  offenseBuff?: number;
  defenseBuff?: number;
  skillTokenOptions?: ('ass' | 'raid' | 'sub')[];
  discardHandCount?: number;
  discardFieldCount?: number;
  siphonCoins?: number;
  drawCount?: number;
  canPlayOnDefense?: boolean;
  costDiscount?: number;
  customNotes?: string;
}

export interface AbilityPreset {
  id: string;
  name: string;
  category: AbilityCategory;
  trigger: AbilityTrigger;
  description: string;
  isBuiltIn?: boolean;
  canPlayOnDefense?: boolean;
  config?: AbilityConfig;
}

export const BUILT_IN_ABILITY_PRESETS: AbilityPreset[] = [
  {
    id: 'assemble_strike_defense',
    name: 'Assemble Strike or Defense Team',
    category: 'Support',
    trigger: 'reaction_defense',
    canPlayOnDefense: true,
    description: 'Play to assemble a Strike Team (+2 Offense token) OR Defense Team (+2 Defense token). Can be played out-of-turn as an instant reaction when Intercepting an attack to add +2 DEF.',
    isBuiltIn: true,
    config: {
      offenseBuff: 2,
      defenseBuff: 2,
      canPlayOnDefense: true,
    }
  },
  {
    id: 'sacrifice_discard_hand_or_field',
    name: 'Sacrifice: Force Discard (Hand or 2 In-Play)',
    category: 'Operative',
    trigger: 'sacrifice',
    description: 'Sacrifice (discard while in play) to force Opponent to discard 1 card from hand OR discard any 2 of Opponent cards in play.',
    isBuiltIn: true,
    config: {
      discardHandCount: 1,
      discardFieldCount: 2,
    }
  },
  {
    id: 'grant_skill_token',
    name: 'Tap: Grant +1 SUB, ASS, or RAID Skill Token',
    category: 'Universal',
    trigger: 'activated_tap',
    description: 'Exhaust (tap) to place a +1 Subterfuge, Assassin, or Raid token on any Operative in play. By default, cannot be placed on an operative that already has that skill unless duplicate tokens are enabled in Settings.',
    isBuiltIn: true,
    config: {
      skillTokenOptions: ['ass', 'raid', 'sub']
    }
  },
  {
    id: 'buff_off_or_def',
    name: 'Tap: Grant +1 Offense or +1 Defense',
    category: 'Universal',
    trigger: 'activated_tap',
    description: 'Exhaust (tap) to give any target operative +1 Offense or +1 Defense until the end of the round.',
    isBuiltIn: true,
    config: {
      offenseBuff: 1,
      defenseBuff: 1
    }
  },
  {
    id: 'defensive_reaction_support',
    name: 'Quick Support: Out-of-Turn Defensive Reaction',
    category: 'Support',
    trigger: 'reaction_defense',
    canPlayOnDefense: true,
    description: 'Support card that can be cast out-of-turn when you are defending/intercepting an attack to fortify defense by +2 and thwart attackers.',
    isBuiltIn: true,
    config: {
      defenseBuff: 2,
      canPlayOnDefense: true
    }
  },
  {
    id: 'buff_skill',
    name: 'MI6 Special: Grant +1 Skill Token',
    category: 'Affiliation',
    trigger: 'activated_tap',
    description: 'Tap affiliation to grant a friendly operative +1 Raid, Assassin, or Subterfuge token.',
    isBuiltIn: true,
    config: {
      skillTokenOptions: ['ass', 'raid', 'sub']
    }
  },
  {
    id: 'armory_buff',
    name: 'Armory: Buff Operative +1 OFF or +1 DEF',
    category: 'Location',
    trigger: 'activated_tap',
    description: 'Tap location to grant a friendly operative +1 Offense or +1 Defense.',
    isBuiltIn: true,
    config: {
      offenseBuff: 1,
      defenseBuff: 1
    }
  },
  {
    id: 'spawn_token',
    name: 'Shadow Home: Spawn 1/1 Token Operative',
    category: 'Affiliation',
    trigger: 'activated_tap',
    description: 'Tap affiliation to deploy a 1/1 Shadow Warrior token into play.',
    isBuiltIn: true,
  },
  {
    id: 'draw',
    name: 'Impossible Mission Force: Tap to Draw',
    category: 'Affiliation',
    trigger: 'activated_tap',
    description: 'Tap affiliation to draw 1 card from your deck into hand.',
    isBuiltIn: true,
    config: {
      drawCount: 1
    }
  },
  {
    id: 'draw_card',
    name: 'Research Facility: Tap to Draw',
    category: 'Location',
    trigger: 'activated_tap',
    description: 'Tap location to draw 1 card from your deck into hand.',
    isBuiltIn: true,
    config: {
      drawCount: 1
    }
  },
  {
    id: 'force_discard',
    name: 'Troll Farm: Force Opponent Discard',
    category: 'Location',
    trigger: 'activated_tap',
    description: 'Tap location to force opponent to discard 1 card from their hand.',
    isBuiltIn: true,
    config: {
      discardHandCount: 1
    }
  },
  {
    id: 'boksoon_discard_ass1',
    name: 'Boksoon Execution: Discard Enemy Assassin',
    category: 'Operative',
    trigger: 'activated_tap',
    description: 'Tap to execute and discard any enemy operative with Assassin skill >= 1.',
    isBuiltIn: true
  },
  {
    id: 'mata_hari_steal_card',
    name: 'Mata Hari Charm: Steal Hand Card',
    category: 'Operative',
    trigger: 'activated_tap',
    description: 'Tap to steal a random card from the opponent hand.',
    isBuiltIn: true
  },
  {
    id: 'ghost_siphon_2',
    name: 'Ghost Cyber-Siphon: Siphon 2 Resources',
    category: 'Operative',
    trigger: 'activated_tap',
    description: 'Siphon up to 2 coins from the opponent upon deployment and when tapped.',
    isBuiltIn: true,
    config: {
      siphonCoins: 2
    }
  },
  {
    id: 'dan_weak_sacrifice',
    name: 'Dan Weak Sacrifice: Hand Wipe or Field Discard',
    category: 'Operative',
    trigger: 'sacrifice',
    description: 'Sacrifice Dan Weak to force opponent to discard entire hand OR discard 2 cards in play.',
    isBuiltIn: true,
    config: {
      discardFieldCount: 2
    }
  },
  {
    id: 'play_operative',
    name: 'MK Entertainment: Operatives Cost 1 Fewer Coin',
    category: 'Affiliation',
    trigger: 'passive',
    description: 'Passive discount: friendly Operatives cost 1 fewer resource to deploy (min 0).',
    isBuiltIn: true,
    config: {
      costDiscount: 1
    }
  }
];

const STORAGE_KEY = 'spywar_ability_presets_v2';

export class AbilityPresetService {
  private static instance: AbilityPresetService;
  private customPresets: AbilityPreset[] = [];

  private constructor() {
    this.loadPresets();
  }

  public static getInstance(): AbilityPresetService {
    if (!AbilityPresetService.instance) {
      AbilityPresetService.instance = new AbilityPresetService();
    }
    return AbilityPresetService.instance;
  }

  private loadPresets(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.customPresets = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load custom ability presets:', e);
      this.customPresets = [];
    }
  }

  private savePresets(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customPresets));
    } catch (e) {
      console.error('Failed to persist ability presets:', e);
    }
  }

  public getAllPresets(): AbilityPreset[] {
    const customMap = new Map(this.customPresets.map(p => [p.id, p]));
    const list: AbilityPreset[] = [];

    // Built-in presets (override with custom if modified)
    for (const def of BUILT_IN_ABILITY_PRESETS) {
      if (customMap.has(def.id)) {
        list.push(customMap.get(def.id)!);
        customMap.delete(def.id);
      } else {
        list.push(def);
      }
    }

    // Remaining purely custom presets
    for (const custom of customMap.values()) {
      list.push(custom);
    }

    return list;
  }

  public getPresetById(id: string): AbilityPreset | undefined {
    return this.getAllPresets().find(p => p.id === id);
  }

  public savePreset(preset: AbilityPreset): void {
    const existingIdx = this.customPresets.findIndex(p => p.id === preset.id);
    if (existingIdx >= 0) {
      this.customPresets[existingIdx] = { ...preset, isBuiltIn: false };
    } else {
      this.customPresets.push({ ...preset, isBuiltIn: false });
    }
    this.savePresets();
  }

  public deletePreset(id: string): boolean {
    const isBuiltIn = BUILT_IN_ABILITY_PRESETS.some(p => p.id === id);
    if (isBuiltIn) {
      // If it was a modified built-in, removing it resets it to factory default
      this.customPresets = this.customPresets.filter(p => p.id !== id);
      this.savePresets();
      return true;
    }

    const prevLen = this.customPresets.length;
    this.customPresets = this.customPresets.filter(p => p.id !== id);
    this.savePresets();
    return this.customPresets.length < prevLen;
  }

  public resetToDefaults(): void {
    this.customPresets = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  public exportPresetsJson(): string {
    return JSON.stringify(this.getAllPresets(), null, 2);
  }

  public importPresetsJson(jsonStr: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        return { success: false, count: 0, error: 'Expected an array of ability presets.' };
      }

      let count = 0;
      for (const item of parsed) {
        if (item.id && item.name) {
          const valid: AbilityPreset = {
            id: String(item.id).trim().toLowerCase().replace(/\s+/g, '_'),
            name: String(item.name).trim(),
            category: item.category || 'Universal',
            trigger: item.trigger || 'activated_tap',
            description: item.description || '',
            canPlayOnDefense: !!item.canPlayOnDefense,
            config: item.config || {},
            isBuiltIn: false
          };
          this.savePreset(valid);
          count++;
        }
      }

      return { success: true, count };
    } catch (e: any) {
      return { success: false, count: 0, error: e.message || 'Invalid JSON syntax.' };
    }
  }
}
