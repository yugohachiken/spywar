import { Card, Mission } from '../types/spywar';
import { 
  AFFILIATION_CARDS, 
  LOCATION_CARDS, 
  OPERATIVE_CARDS, 
  SUPPORT_CARDS, 
  MASTER_MISSIONS 
} from '../engine/cardManifest';
import { EngineConfig, DEFAULT_CONFIG } from '../engine/SpywarEngine';

export interface DeckPreset {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
  cardQuantities: Record<string, number>; // cardId -> quantity in deck
  enabledAffiliations: string[]; // affiliation card IDs allowed to draft
  startingMissions?: number;
}

const STORAGE_KEYS = {
  CARDS: 'spywar_custom_cards_v1',
  ACTIVE_DECK: 'spywar_active_deck_v1',
  PRESETS: 'spywar_deck_presets_v1',
  GAME_CONFIG: 'spywar_game_config_v1',
};

export const ORIGINAL_CARD_IDS = new Set<string>([
  ...AFFILIATION_CARDS.map(c => c.id),
  ...LOCATION_CARDS.map(c => c.id),
  ...OPERATIVE_CARDS.map(c => c.id),
  ...SUPPORT_CARDS.map(c => c.id),
]);

export function isOriginalCard(id: string): boolean {
  return ORIGINAL_CARD_IDS.has(id);
}

// Base factory cards copy with isOriginal: true
export function getFactoryCards(): Card[] {
  return [
    ...AFFILIATION_CARDS.map(c => ({ ...c, isOriginal: true })),
    ...LOCATION_CARDS.map(c => ({ ...c, isOriginal: true })),
    ...OPERATIVE_CARDS.map(c => ({ ...c, isOriginal: true })),
    ...SUPPORT_CARDS.map(c => ({ ...c, isOriginal: true })),
  ];
}

export const BUILT_IN_PRESETS: DeckPreset[] = [
  {
    id: 'preset_standard',
    name: 'Official Standard',
    description: 'The official standard Spywar deck balanced for competitive play with all classic cards and factions.',
    isBuiltIn: true,
    enabledAffiliations: AFFILIATION_CARDS.map(a => a.id),
    cardQuantities: {
      'loc_bd': 5,
      'loc_bank': 5,
      'loc_armory': 2,
      'loc_troll': 2,
      'loc_res': 2,
      'loc_chop': 4,
      'op_rookie': 4,
      'op_vet_ass': 2,
      'op_vet_inf': 2,
      'op_vet_hack': 2,
      'op_elite_ass': 2,
      'op_elite_inf': 2,
      'op_elite_hack': 2,
      'op_boksoon': 1,
      'op_mata_hari': 1,
      'op_ghost': 1,
      'op_dan_weak': 1,
      'sup_funding': 5,
      'sup_ass_train': 2,
      'sup_raid_train': 2,
      'sup_sub_train': 2,
      'sup_crew': 4,
      'sup_acq': 4,
      'sup_whitewash': 4,
      'sup_double_agent': 4,
      'sup_hiring_hackers': 4,
      'sup_hired_sub': 4,
      'sup_hired_ass': 4,
      'sup_global_dominion': 1,
    }
  },
  {
    id: 'preset_assassin_strike',
    name: 'Assassin Strike Syndicate',
    description: 'Hyper-aggressive offensive combat deck focused on heavy Assassin operatives, combat training, and elite eliminations.',
    isBuiltIn: true,
    enabledAffiliations: ['aff_shadow', 'aff_mi6', 'aff_mk'],
    cardQuantities: {
      'loc_bd': 4,
      'loc_armory': 4,
      'loc_chop': 4,
      'op_rookie': 4,
      'op_vet_ass': 4,
      'op_elite_ass': 4,
      'op_boksoon': 2,
      'op_dan_weak': 2,
      'sup_funding': 6,
      'sup_ass_train': 4,
      'sup_crew': 4,
      'sup_whitewash': 4,
      'sup_hired_ass': 4,
    }
  },
  {
    id: 'preset_heist_raid',
    name: 'Corporate Heist & Raid',
    description: 'High-yield economic warfare deck centered on high coin capacity, banks, veteran hackers, and rapid resource siphoning.',
    isBuiltIn: true,
    enabledAffiliations: ['aff_uncle', 'aff_imf', 'aff_mk'],
    cardQuantities: {
      'loc_bd': 6,
      'loc_bank': 6,
      'loc_chop': 4,
      'loc_res': 3,
      'op_vet_hack': 4,
      'op_elite_hack': 4,
      'op_ghost': 2,
      'sup_funding': 6,
      'sup_raid_train': 4,
      'sup_acq': 4,
      'sup_hiring_hackers': 6,
    }
  },
  {
    id: 'preset_shadow_subterfuge',
    name: 'Black Ops & Subterfuge',
    description: 'Disruptive control deck aimed at depleting enemy cards in hand, stealing assets, and denying operational tempo.',
    isBuiltIn: true,
    enabledAffiliations: ['aff_imf', 'aff_shadow', 'aff_mi6'],
    cardQuantities: {
      'loc_troll': 4,
      'loc_res': 3,
      'loc_bd': 4,
      'loc_chop': 4,
      'op_rookie': 4,
      'op_vet_inf': 4,
      'op_elite_inf': 4,
      'op_mata_hari': 2,
      'sup_sub_train': 4,
      'sup_double_agent': 4,
      'sup_hired_sub': 4,
      'sup_funding': 4,
    }
  }
];

export class CardDatabaseService {
  private static instance: CardDatabaseService;
  private cards: Card[] = [];
  private activeDeck: DeckPreset;
  private presets: DeckPreset[] = [];
  private gameConfig: EngineConfig = { ...DEFAULT_CONFIG };

  private constructor() {
    this.loadCards();
    this.loadPresets();
    this.loadActiveDeck();
    this.loadGameConfig();
  }

  public static getInstance(): CardDatabaseService {
    if (!CardDatabaseService.instance) {
      CardDatabaseService.instance = new CardDatabaseService();
    }
    return CardDatabaseService.instance;
  }

  // Game Settings Management
  private loadGameConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GAME_CONFIG);
      if (stored) {
        this.gameConfig = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      } else {
        this.gameConfig = { ...DEFAULT_CONFIG };
      }
    } catch {
      this.gameConfig = { ...DEFAULT_CONFIG };
    }
  }

  public getGameConfig(): EngineConfig {
    return { ...this.gameConfig };
  }

  public saveGameConfig(config: Partial<EngineConfig>): EngineConfig {
    this.gameConfig = { ...this.gameConfig, ...config };
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_CONFIG, JSON.stringify(this.gameConfig));
    } catch (e) {
      console.error('Failed to save game config to localStorage', e);
    }
    return { ...this.gameConfig };
  }

  public resetGameConfig(): EngineConfig {
    this.gameConfig = { ...DEFAULT_CONFIG };
    try {
      localStorage.setItem(STORAGE_KEYS.GAME_CONFIG, JSON.stringify(this.gameConfig));
    } catch (e) {
      console.error('Failed to reset game config in localStorage', e);
    }
    return { ...this.gameConfig };
  }

  // Cards Management
  private loadCards() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CARDS);
      const factory = getFactoryCards();
      if (stored) {
        const parsed: Card[] = JSON.parse(stored);
        // Custom user cards are those not belonging to the immutable core set
        const customCards = parsed.filter(c => !ORIGINAL_CARD_IDS.has(c.id));
        // The original cards are ALWAYS loaded fresh from factory definitions to guarantee immutability
        this.cards = [...factory, ...customCards];
      } else {
        this.cards = factory;
      }
    } catch {
      this.cards = getFactoryCards();
    }
  }

  public isOriginalCard(id: string): boolean {
    return ORIGINAL_CARD_IDS.has(id);
  }

  public saveCardsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(this.cards));
    } catch (e) {
      console.error('Failed to save cards to localStorage', e);
    }
  }

  public getAllCards(): Card[] {
    return [...this.cards];
  }

  public getCardsByType(type: Card['type']): Card[] {
    return this.cards.filter(c => c.type === type);
  }

  public getCardById(id: string): Card | undefined {
    return this.cards.find(c => c.id === id);
  }

  /**
   * Saves a card. If the card is an immutable core card, it automatically
   * branches to a new custom card version, leaving the original 100% intact.
   */
  public saveCard(cardToSave: Card): { savedCard: Card; branched: boolean } {
    // If attempting to modify an original card, branch it to a custom card version
    if (this.isOriginalCard(cardToSave.id)) {
      const branchSuffix = Date.now().toString().slice(-6);
      const cleanBase = cardToSave.id.replace(/^(op_|loc_|sup_|aff_)/, '');
      const newId = `custom_${cleanBase}_${branchSuffix}`;
      const defaultName = cardToSave.name.includes('(Custom)') 
        ? cardToSave.name 
        : `${cardToSave.name} (Custom)`;

      const branchedCard: Card = {
        ...cardToSave,
        id: newId,
        name: defaultName,
        isOriginal: false,
        parentCardId: cardToSave.id,
        version: 1,
      };

      this.cards.push(branchedCard);
      this.saveCardsToStorage();

      // Ensure active deck incorporates the custom card if desired
      if (branchedCard.type !== 'Affiliation' && !this.activeDeck.cardQuantities.hasOwnProperty(branchedCard.id)) {
        this.activeDeck.cardQuantities[branchedCard.id] = branchedCard.qty || 2;
        this.saveActiveDeckToStorage();
      } else if (branchedCard.type === 'Affiliation' && !this.activeDeck.enabledAffiliations.includes(branchedCard.id)) {
        this.activeDeck.enabledAffiliations.push(branchedCard.id);
        this.saveActiveDeckToStorage();
      }

      return { savedCard: branchedCard, branched: true };
    }

    // It's a custom card: update existing or add new
    const idx = this.cards.findIndex(c => c.id === cardToSave.id);
    const finalizedCard: Card = {
      ...cardToSave,
      isOriginal: false,
    };

    if (idx >= 0) {
      this.cards[idx] = finalizedCard;
    } else {
      this.cards.push(finalizedCard);
    }
    this.saveCardsToStorage();
    
    // Also ensure active deck has an entry for it if it's playable
    if (finalizedCard.type !== 'Affiliation' && !this.activeDeck.cardQuantities.hasOwnProperty(finalizedCard.id)) {
      this.activeDeck.cardQuantities[finalizedCard.id] = finalizedCard.qty || 2;
      this.saveActiveDeckToStorage();
    } else if (finalizedCard.type === 'Affiliation' && !this.activeDeck.enabledAffiliations.includes(finalizedCard.id)) {
      this.activeDeck.enabledAffiliations.push(finalizedCard.id);
      this.saveActiveDeckToStorage();
    }

    return { savedCard: finalizedCard, branched: false };
  }

  /**
   * Explicitly branch any card to a new custom version.
   */
  public branchCard(sourceId: string, customOverrides?: Partial<Card>): Card | null {
    const source = this.cards.find(c => c.id === sourceId);
    if (!source) return null;

    const branchSuffix = Date.now().toString().slice(-6);
    const cleanBase = source.id.replace(/^(op_|loc_|sup_|aff_|custom_)/, '');
    const newId = `custom_${cleanBase}_${branchSuffix}`;
    const defaultName = customOverrides?.name || (
      source.name.includes('(Custom)') 
        ? `${source.name} Copy` 
        : `${source.name} (Custom)`
    );

    const branched: Card = {
      ...source,
      ...customOverrides,
      id: newId,
      name: defaultName,
      isOriginal: false,
      parentCardId: source.id,
      version: (source.version || 1) + 1,
    };

    this.cards.push(branched);
    this.saveCardsToStorage();

    if (branched.type !== 'Affiliation') {
      this.activeDeck.cardQuantities[branched.id] = branched.qty || 2;
      this.saveActiveDeckToStorage();
    } else if (!this.activeDeck.enabledAffiliations.includes(branched.id)) {
      this.activeDeck.enabledAffiliations.push(branched.id);
      this.saveActiveDeckToStorage();
    }

    return branched;
  }

  public deleteCard(id: string): boolean {
    if (this.isOriginalCard(id)) {
      console.warn(`Card ${id} is an original immutable card and cannot be deleted.`);
      return false;
    }
    const idx = this.cards.findIndex(c => c.id === id);
    if (idx >= 0) {
      this.cards.splice(idx, 1);
      this.saveCardsToStorage();

      // Remove from active deck & presets
      delete this.activeDeck.cardQuantities[id];
      this.activeDeck.enabledAffiliations = this.activeDeck.enabledAffiliations.filter(aid => aid !== id);
      this.saveActiveDeckToStorage();
      return true;
    }
    return false;
  }

  public resetCardsToDefault() {
    // Restores original factory cards while keeping player-created custom cards safe
    const factory = getFactoryCards();
    const customCards = this.cards.filter(c => !this.isOriginalCard(c.id));
    this.cards = [...factory, ...customCards];
    this.saveCardsToStorage();
    this.activeDeck = { 
      ...BUILT_IN_PRESETS[0],
      cardQuantities: { ...BUILT_IN_PRESETS[0].cardQuantities },
      enabledAffiliations: [...BUILT_IN_PRESETS[0].enabledAffiliations]
    };
    this.saveActiveDeckToStorage();
  }

  // Presets & Active Deck Management
  public isBuiltInPreset(id: string): boolean {
    return BUILT_IN_PRESETS.some(p => p.id === id);
  }

  private loadPresets() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PRESETS);
      if (stored) {
        const userPresets: DeckPreset[] = JSON.parse(stored);
        this.presets = [
          ...BUILT_IN_PRESETS.map(p => ({
            ...p,
            cardQuantities: { ...p.cardQuantities },
            enabledAffiliations: [...p.enabledAffiliations]
          })),
          ...userPresets
        ];
      } else {
        this.presets = [
          ...BUILT_IN_PRESETS.map(p => ({
            ...p,
            cardQuantities: { ...p.cardQuantities },
            enabledAffiliations: [...p.enabledAffiliations]
          }))
        ];
      }
    } catch {
      this.presets = [
        ...BUILT_IN_PRESETS.map(p => ({
          ...p,
          cardQuantities: { ...p.cardQuantities },
          enabledAffiliations: [...p.enabledAffiliations]
        }))
      ];
    }
  }

  private loadActiveDeck() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_DECK);
      if (stored) {
        this.activeDeck = JSON.parse(stored);
      } else {
        this.activeDeck = { 
          ...BUILT_IN_PRESETS[0],
          cardQuantities: { ...BUILT_IN_PRESETS[0].cardQuantities },
          enabledAffiliations: [...BUILT_IN_PRESETS[0].enabledAffiliations]
        };
      }
    } catch {
      this.activeDeck = { 
        ...BUILT_IN_PRESETS[0],
        cardQuantities: { ...BUILT_IN_PRESETS[0].cardQuantities },
        enabledAffiliations: [...BUILT_IN_PRESETS[0].enabledAffiliations]
      };
    }
  }

  public saveActiveDeckToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DECK, JSON.stringify(this.activeDeck));
    } catch (e) {
      console.error('Failed to save active deck', e);
    }
  }

  public getActiveDeck(): DeckPreset {
    return { 
      ...this.activeDeck,
      cardQuantities: { ...this.activeDeck.cardQuantities },
      enabledAffiliations: [...this.activeDeck.enabledAffiliations]
    };
  }

  public setActiveDeck(deck: DeckPreset) {
    this.activeDeck = { 
      ...deck,
      cardQuantities: { ...deck.cardQuantities },
      enabledAffiliations: [...deck.enabledAffiliations]
    };
    this.saveActiveDeckToStorage();
  }

  /**
   * Branches the current active deck to a new custom player preset.
   * Keeps original built-in presets pristine and untouched.
   */
  public branchActiveDeck(customName?: string): DeckPreset {
    const parentName = this.activeDeck.name;
    const branchName = customName || (
      parentName.includes('(Custom)') 
        ? `${parentName} Copy` 
        : `${parentName} (Custom)`
    );

    const branched: DeckPreset = {
      id: `preset_user_${Date.now()}`,
      name: branchName,
      description: `Custom branch of ${parentName}. Created on ${new Date().toLocaleDateString()}.`,
      isBuiltIn: false,
      cardQuantities: { ...this.activeDeck.cardQuantities },
      enabledAffiliations: [...this.activeDeck.enabledAffiliations],
    };

    this.presets.push(branched);
    this.saveUserPresetsToStorage();
    this.setActiveDeck(branched);
    return branched;
  }

  public updateActiveDeckQuantity(cardId: string, quantity: number): { deck: DeckPreset; branched: boolean } {
    let branched = false;
    // Copy-on-write: if modifying an original built-in preset, branch to a custom deck first!
    if (this.activeDeck.isBuiltIn) {
      this.branchActiveDeck();
      branched = true;
    }

    const safeQty = Math.max(0, Math.min(15, quantity));
    if (safeQty === 0) {
      delete this.activeDeck.cardQuantities[cardId];
    } else {
      this.activeDeck.cardQuantities[cardId] = safeQty;
    }
    this.saveActiveDeckToStorage();
    return { deck: this.activeDeck, branched };
  }

  public toggleActiveDeckAffiliation(affId: string): { deck: DeckPreset; branched: boolean } {
    let branched = false;
    // Copy-on-write: if modifying an original built-in preset, branch to a custom deck first!
    if (this.activeDeck.isBuiltIn) {
      this.branchActiveDeck();
      branched = true;
    }

    if (this.activeDeck.enabledAffiliations.includes(affId)) {
      if (this.activeDeck.enabledAffiliations.length > 2) {
        this.activeDeck.enabledAffiliations = this.activeDeck.enabledAffiliations.filter(id => id !== affId);
      }
    } else {
      this.activeDeck.enabledAffiliations.push(affId);
    }
    this.saveActiveDeckToStorage();
    return { deck: this.activeDeck, branched };
  }

  public getAllPresets(): DeckPreset[] {
    const userOnly = this.presets.filter(p => !p.isBuiltIn);
    return [
      ...BUILT_IN_PRESETS.map(p => ({
        ...p,
        cardQuantities: { ...p.cardQuantities },
        enabledAffiliations: [...p.enabledAffiliations]
      })),
      ...userOnly
    ];
  }

  public saveNewPreset(name: string, description: string): DeckPreset {
    const newPreset: DeckPreset = {
      id: `preset_user_${Date.now()}`,
      name,
      description,
      isBuiltIn: false,
      cardQuantities: { ...this.activeDeck.cardQuantities },
      enabledAffiliations: [...this.activeDeck.enabledAffiliations],
    };
    this.presets.push(newPreset);
    this.saveUserPresetsToStorage();
    this.setActiveDeck(newPreset);
    return newPreset;
  }

  public deletePreset(id: string): boolean {
    if (this.isBuiltInPreset(id)) {
      console.warn(`Cannot delete built-in deck preset ${id}. Original presets are immutable.`);
      return false;
    }
    const idx = this.presets.findIndex(p => p.id === id && !p.isBuiltIn);
    if (idx >= 0) {
      this.presets.splice(idx, 1);
      this.saveUserPresetsToStorage();
      if (this.activeDeck.id === id) {
        this.setActiveDeck(BUILT_IN_PRESETS[0]);
      }
      return true;
    }
    return false;
  }

  private saveUserPresetsToStorage() {
    try {
      const userOnly = this.presets.filter(p => !p.isBuiltIn);
      localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(userOnly));
    } catch (e) {
      console.error('Failed to save user presets', e);
    }
  }

  // Export / Import JSON
  public exportDatabaseJSON(): string {
    return JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      cards: this.cards,
      activeDeck: this.activeDeck,
      presets: this.presets.filter(p => !p.isBuiltIn),
    }, null, 2);
  }

  public importDatabaseJSON(jsonStr: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.cards || !Array.isArray(data.cards)) {
        return { success: false, message: 'Invalid JSON format: missing cards array.' };
      }
      this.cards = data.cards;
      this.saveCardsToStorage();

      if (data.activeDeck) {
        this.activeDeck = data.activeDeck;
        this.saveActiveDeckToStorage();
      }
      if (data.presets && Array.isArray(data.presets)) {
        this.presets = [...BUILT_IN_PRESETS, ...data.presets];
        this.saveUserPresetsToStorage();
      }
      return { success: true, message: `Successfully imported ${this.cards.length} cards!` };
    } catch (err: any) {
      return { success: false, message: `Import error: ${err?.message || 'Invalid JSON'}` };
    }
  }

  // Generate real deck cards array for SpywarEngine
  public generateGameDeckForEngine(): {
    affiliationDeck: Card[];
    drawDeck: Card[];
    missions: Mission[];
  } {
    const allCards = this.getAllCards();
    const cardMap = new Map<string, Card>(allCards.map(c => [c.id, c]));

    // 1. Affiliations
    const affIds = this.activeDeck.enabledAffiliations.length >= 2 
      ? this.activeDeck.enabledAffiliations 
      : allCards.filter(c => c.type === 'Affiliation').map(c => c.id);

    const affiliationDeck: Card[] = affIds
      .map(id => cardMap.get(id))
      .filter((c): c is Card => !!c)
      .map(c => ({ ...c }));

    // Fallback if none found
    if (affiliationDeck.length < 2) {
      const defaultAffs = allCards.filter(c => c.type === 'Affiliation');
      affiliationDeck.push(...defaultAffs);
    }

    // 2. Draw Deck
    const drawDeck: Card[] = [];
    const locCards: Card[] = [];
    const opCards: Card[] = [];
    const supCards: Card[] = [];

    for (const [cardId, count] of Object.entries(this.activeDeck.cardQuantities)) {
      const template = cardMap.get(cardId);
      if (!template || count <= 0) continue;

      for (let i = 0; i < count; i++) {
        const inst: Card = {
          ...template,
          id: `${template.id}_deck_${i}`,
        };
        if (template.type === 'Location') locCards.push(inst);
        else if (template.type === 'Operative') opCards.push(inst);
        else if (template.type === 'Support') supCards.push(inst);
        else drawDeck.push(inst);
      }
    }

    // If deck is too small, inject sensible defaults so game doesn't crash on draw
    if (locCards.length < 2 || opCards.length < 2 || supCards.length < 2) {
      // Provide standard backups
      const rookies = allCards.find(c => c.name === 'Rookie') || allCards.find(c => c.type === 'Operative');
      const bds = allCards.find(c => c.name === 'Business District') || allCards.find(c => c.type === 'Location');
      const funds = allCards.find(c => c.name === 'Funding') || allCards.find(c => c.type === 'Support');

      while (locCards.length < 4 && bds) locCards.push({ ...bds, id: `loc_fallback_${locCards.length}` });
      while (opCards.length < 4 && rookies) opCards.push({ ...rookies, id: `op_fallback_${opCards.length}` });
      while (supCards.length < 4 && funds) supCards.push({ ...funds, id: `sup_fallback_${supCards.length}` });
    }

    // Shuffle each category
    locCards.sort(() => Math.random() - 0.5);
    opCards.sort(() => Math.random() - 0.5);
    supCards.sort(() => Math.random() - 0.5);

    // Initial hand distribution requires 1 loc, 1 op, 1 sup per player (2 players)
    // The rest form the draw deck
    drawDeck.push(...locCards, ...opCards, ...supCards);

    return {
      affiliationDeck,
      drawDeck,
      missions: [...MASTER_MISSIONS].map(m => ({ ...m, tokens: { P1: 0, P2: 0 } })),
    };
  }
}
