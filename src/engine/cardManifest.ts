import { Card, Mission } from '../types/spywar';

export const AFFILIATION_CARDS: Card[] = [
  {
    id: 'aff_imf',
    name: 'Impossible Mission Force',
    type: 'Affiliation',
    cost: 0,
    production: 2,
    cap: 5,
    specialAbility: 'draw',
    abilityText: 'Tap: Draw a card.'
  },
  {
    id: 'aff_uncle',
    name: 'UNCLE',
    type: 'Affiliation',
    cost: 0,
    production: 4,
    cap: 5,
    abilityText: 'Passive: High base production (4 coins/turn).'
  },
  {
    id: 'aff_mi6',
    name: 'MI6',
    type: 'Affiliation',
    cost: 0,
    production: 2,
    cap: 5,
    specialAbility: 'buff_skill',
    abilityText: 'Tap: Grant an operative +1 Raid, Assassin, or Subterfuge.'
  },
  {
    id: 'aff_mk',
    name: 'MK Entertainment',
    type: 'Affiliation',
    cost: 0,
    production: 2,
    cap: 5,
    specialAbility: 'play_operative',
    abilityText: 'Passive: Operatives cost 1 fewer coin to deploy.'
  },
  {
    id: 'aff_shadow',
    name: 'Shadow Home',
    type: 'Affiliation',
    cost: 0,
    production: 1,
    cap: 5,
    specialAbility: 'spawn_token',
    abilityText: 'Tap: Spawn a 1/1 Shadow Warrior token with Assassin 1.'
  },
  {
    id: 'aff_mica',
    name: 'M.I.C.A.',
    type: 'Affiliation',
    cost: 0,
    production: 2,
    cap: 5,
    specialAbility: 'buff_tech_token',
    abilityText: 'Tap: Give target friendly operative +1/+1 Tech token.'
  }
];

export const LOCATION_CARDS: Card[] = [
  {
    id: 'loc_bd',
    name: 'Business District',
    type: 'Location',
    cost: 2,
    qty: 5,
    production: 2,
    cap: 2,
    abilityText: 'Generates 2 coins. Stores up to 2 coins.'
  },
  {
    id: 'loc_bank',
    name: 'Bank',
    type: 'Location',
    cost: 3,
    qty: 5,
    production: 3,
    cap: 5,
    abilityText: 'Holds up to 5 resources (overrides default capacity).'
  },
  {
    id: 'loc_armory',
    name: 'Armory',
    type: 'Location',
    cost: 2,
    qty: 2,
    production: 1,
    cap: 1,
    specialAbility: 'armory_buff',
    abilityText: 'Tap: Give a target operative +1 Offense or +1 Defense.'
  },
  {
    id: 'loc_troll',
    name: 'Troll Farm',
    type: 'Location',
    cost: 2,
    qty: 2,
    production: 1,
    cap: 1,
    specialAbility: 'force_discard',
    abilityText: 'Tap: Force target player to discard a card.'
  },
  {
    id: 'loc_res',
    name: 'Research Facility',
    type: 'Location',
    cost: 4,
    qty: 2,
    production: 3,
    cap: 3,
    specialAbility: 'draw_card',
    abilityText: 'Tap: Draw a card.'
  },
  {
    id: 'loc_chop',
    name: 'Chop Chop Shop',
    type: 'Location',
    cost: 1,
    qty: 4,
    production: 1,
    cap: 1,
    abilityText: 'Generates 1 coin. Stores up to 1 coin.'
  }
];

export const OPERATIVE_CARDS: Card[] = [
  {
    id: 'op_rookie',
    name: 'Rookie',
    type: 'Operative',
    cost: 1,
    qty: 4,
    off: 1,
    def: 1,
    ass: 0,
    raid: 0,
    sub: 0,
    abilityText: 'Basic field operative.'
  },
  {
    id: 'op_vet_ass',
    name: 'Veteran Assassin',
    type: 'Operative',
    cost: 2,
    qty: 2,
    off: 2,
    def: 2,
    ass: 1,
    raid: 0,
    sub: 0,
    abilityText: 'Assassin rank 1.'
  },
  {
    id: 'op_vet_inf',
    name: 'Veteran Infiltrator',
    type: 'Operative',
    cost: 2,
    qty: 2,
    off: 2,
    def: 2,
    ass: 0,
    raid: 0,
    sub: 1,
    abilityText: 'Subterfuge rank 1.'
  },
  {
    id: 'op_vet_hack',
    name: 'Veteran Hacker',
    type: 'Operative',
    cost: 2,
    qty: 2,
    off: 2,
    def: 2,
    ass: 0,
    raid: 1,
    sub: 0,
    abilityText: 'Raid rank 1.'
  },
  {
    id: 'op_elite_ass',
    name: 'Elite Assassin',
    type: 'Operative',
    cost: 3,
    qty: 2,
    off: 3,
    def: 2,
    ass: 2,
    raid: 0,
    sub: 0,
    abilityText: 'Assassin rank 2.'
  },
  {
    id: 'op_elite_inf',
    name: 'Elite Infiltrator',
    type: 'Operative',
    cost: 3,
    qty: 2,
    off: 2,
    def: 2,
    ass: 0,
    raid: 0,
    sub: 2,
    abilityText: 'Subterfuge rank 2.'
  },
  {
    id: 'op_elite_hack',
    name: 'Elite Hacker',
    type: 'Operative',
    cost: 3,
    qty: 2,
    off: 2,
    def: 3,
    ass: 0,
    raid: 2,
    sub: 0,
    abilityText: 'Raid rank 2.'
  },
  // Named Operatives
  {
    id: 'op_boksoon',
    name: 'Boksoon',
    type: 'Operative',
    cost: 4,
    qty: 1,
    off: 4,
    def: 3,
    ass: 3,
    raid: 0,
    sub: 0,
    isNamed: true,
    specialAbility: 'boksoon_discard_ass1',
    abilityText: 'Special: Discard an enemy operative in play with Assassin skill >= 1.'
  },
  {
    id: 'op_mata_hari',
    name: 'Mata Hari',
    type: 'Operative',
    cost: 4,
    qty: 1,
    off: 3,
    def: 3,
    ass: 0,
    raid: 0,
    sub: 3,
    isNamed: true,
    specialAbility: 'mata_hari_steal_card',
    abilityText: "Special: Take a random card from target player's hand."
  },
  {
    id: 'op_ghost',
    name: 'Ghost',
    type: 'Operative',
    cost: 4,
    qty: 1,
    off: 3,
    def: 3,
    ass: 0,
    raid: 3,
    sub: 0,
    isNamed: true,
    specialAbility: 'ghost_siphon_2',
    abilityText: 'Deployment / Special: Siphon 2 resources from opponent into your floating pool.'
  },
  {
    id: 'op_dan_weak',
    name: 'Dan Weak',
    type: 'Operative',
    cost: 5,
    qty: 1,
    off: 4,
    def: 4,
    ass: 2,
    raid: 0,
    sub: 2,
    isNamed: true,
    specialAbility: 'dan_weak_sacrifice',
    abilityText: 'Sacrifice from play to either force target to discard hand OR discard 2 cards from play.'
  }
];

export const SUPPORT_CARDS: Card[] = [
  {
    id: 'sup_funding',
    name: 'Funding',
    type: 'Support',
    cost: 0,
    qty: 5,
    abilityText: 'Gain +3 coins to active turn pool.'
  },
  {
    id: 'sup_ass_train',
    name: 'Assassination Training',
    type: 'Support',
    cost: 2,
    qty: 2,
    abilityText: 'Target operative gains Assassin skill +2.'
  },
  {
    id: 'sup_raid_train',
    name: 'Raid Training',
    type: 'Support',
    cost: 2,
    qty: 2,
    abilityText: 'Target operative gains Raid skill +2.'
  },
  {
    id: 'sup_sub_train',
    name: 'Subterfuge Training',
    type: 'Support',
    cost: 2,
    qty: 2,
    abilityText: 'Target operative gains Subterfuge skill +2.'
  },
  {
    id: 'sup_crew',
    name: 'Operative Crew',
    type: 'Support',
    cost: 3,
    qty: 4,
    abilityText: 'Operatives in chosen operation gain +2 Offense or Defense.'
  },
  {
    id: 'sup_acq',
    name: 'Acquisition',
    type: 'Support',
    cost: 4,
    qty: 4,
    abilityText: "Gain control of target player's location."
  },
  {
    id: 'sup_whitewash',
    name: 'Targeted for Whitewash',
    type: 'Support',
    cost: 4,
    qty: 4,
    abilityText: 'Target enemy operative in play is discarded.'
  },
  {
    id: 'sup_double_agent',
    name: 'Double Agent',
    type: 'Support',
    cost: 4,
    qty: 4,
    abilityText: 'Gain control of target enemy operative.'
  },
  {
    id: 'sup_hiring_hackers',
    name: 'Hiring Hackers',
    type: 'Support',
    cost: 4,
    qty: 4,
    abilityText: 'Siphon 3 resources from target player.'
  },
  {
    id: 'sup_hired_sub',
    name: 'Hired Subterfuge',
    type: 'Support',
    cost: 4,
    qty: 4,
    abilityText: 'Target player discards 2 cards from hand.'
  },
  {
    id: 'sup_hired_ass',
    name: 'Hired Assassin',
    type: 'Support',
    cost: 4,
    qty: 4,
    abilityText: 'Gain two 2/2 operative tokens with Assassin 2.'
  },
  {
    id: 'sup_global_dominion',
    name: 'Global Dominion Plan',
    type: 'Support',
    cost: 8,
    qty: 1,
    abilityText: 'Playable ONLY if you eliminated an enemy operative, raided 4+ coins, AND discarded a card from your hand this turn. Immediate victory!'
  }
];

export const MASTER_MISSIONS: Mission[] = [
  {
    id: 'mis_hacker',
    name: 'Master Hacker',
    type: 'res_theft',
    req: 10,
    points: 4,
    tokens: { P1: 0, P2: 0 },
    description: 'Steal a total of 10 resources from other players.'
  },
  {
    id: 'mis_assassin',
    name: 'Master Assassin',
    type: 'kills',
    req: 5,
    points: 5,
    tokens: { P1: 0, P2: 0 },
    description: 'Eliminate a total of 5 operatives.'
  },
  {
    id: 'mis_subterfuge',
    name: 'Master Subterfuge',
    type: 'hand_wipe',
    req: 1,
    points: 5,
    tokens: { P1: 0, P2: 0 },
    description: "Discard a target player's entire card hand."
  },
  {
    id: 'mis_firewall',
    name: 'Firewall Expert',
    type: 'thwart_raid',
    req: 3,
    points: 3,
    tokens: { P1: 0, P2: 0 },
    description: 'Thwart 3 raid attempts with ready defenders.'
  },
  {
    id: 'mis_bodyguard',
    name: 'Expert Bodyguard',
    type: 'thwart_ass',
    req: 3,
    points: 3,
    tokens: { P1: 0, P2: 0 },
    description: 'Thwart 3 assassination attempts on an operative.'
  },
  {
    id: 'mis_counterintel',
    name: 'Counterintelligence',
    type: 'thwart_sub',
    req: 3,
    points: 3,
    tokens: { P1: 0, P2: 0 },
    description: 'Thwart 3 subterfuge attempts.'
  },
  {
    id: 'mis_observer',
    name: 'Observer',
    type: 'no_ops',
    req: 3,
    points: 4,
    tokens: { P1: 0, P2: 0 },
    description: 'Conduct no offensive operations for 3 turns.'
  },
  {
    id: 'mis_testing',
    name: 'Testing the Waters',
    type: 'ops_in_turn',
    req: 3,
    points: 4,
    tokens: { P1: 0, P2: 0 },
    description: 'Perform 3 different operations (Assassinate, Raid, Subterfuge) in 1 turn.'
  },
  {
    id: 'mis_big_spender',
    name: 'Big Spender',
    type: 'empty_hand',
    req: 1,
    points: 4,
    tokens: { P1: 0, P2: 0 },
    description: 'Play your entire hand in one turn.'
  },
  {
    id: 'mis_main_char',
    name: 'Main Character Syndrome',
    type: 'play_named',
    req: 1,
    points: 4,
    tokens: { P1: 0, P2: 0 },
    description: 'Deploy a named unique operative (Boksoon, Mata Hari, Ghost, Dan Weak).'
  }
];
