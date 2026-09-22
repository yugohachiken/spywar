import React, { useState } from 'react';
import { SpywarEngine } from '../engine/SpywarEngine';
import { CardView } from './CardView';
import { Card } from '../types/spywar';
import { ShieldCheck, Skull, Zap, Swords, Building2, Flame, Award, CheckCircle2, XCircle } from 'lucide-react';

interface AbilityTestLabProps {
  engine: SpywarEngine;
  onRefresh: () => void;
}

export const AbilityTestLab: React.FC<AbilityTestLabProps> = ({ engine, onRefresh }) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'named' | 'locations' | 'defense' | 'dominion'>('named');
  const [testLog, setTestLog] = useState<string[]>([]);

  const addTestLog = (msg: string) => {
    setTestLog(prev => [msg, ...prev.slice(0, 19)]);
    onRefresh();
  };

  const p1 = engine.players[0];
  const p2 = engine.players[1];

  // Helper to ensure test setups
  const spawnTestCardToP1 = (cardData: Partial<Card>) => {
    const card: Card = {
      id: `test_${Date.now()}_${Math.random()}`,
      name: cardData.name || 'Test Card',
      type: cardData.type || 'Operative',
      cost: cardData.cost || 0,
      off: cardData.off || 1,
      def: cardData.def || 1,
      ass: cardData.ass || 0,
      raid: cardData.raid || 0,
      sub: cardData.sub || 0,
      specialAbility: cardData.specialAbility,
      abilityText: cardData.abilityText,
      isNamed: cardData.isNamed,
      exhausted: false,
      stored_coins: 0,
      production: cardData.production,
      cap: cardData.cap || 2
    };
    p1.battlefield.push(card);
    addTestLog(`Spawned ${card.name} to Player 1 battlefield.`);
  };

  const spawnTargetToP2 = (isAssassin: boolean = true) => {
    const enemy: Card = {
      id: `enemy_${Date.now()}`,
      name: isAssassin ? 'Enemy Veteran Assassin' : 'Enemy Rookie',
      type: 'Operative',
      cost: 2,
      off: 2,
      def: 2,
      ass: isAssassin ? 1 : 0,
      raid: 0,
      sub: 0,
      exhausted: false,
      abilityText: isAssassin ? 'Target with Assassin skill 1.' : 'No assassin skill.'
    };
    p2.battlefield.push(enemy);
    addTestLog(`Spawned ${enemy.name} to P2 battlefield.`);
  };

  // Test Actions:
  // 1. Boksoon
  const testBoksoonExecute = (target: Card) => {
    const boksoon = p1.battlefield.find(c => c.specialAbility === 'boksoon_discard_ass1');
    if (!boksoon) {
      addTestLog('⚠️ Spawn Boksoon first!');
      return;
    }
    const res = engine.executeAction(p1, p2, {
      type: 'OPERATIVE_ACTION',
      card: boksoon,
      targetCard: target,
      opType: 'boksoon_ass',
      desc: `Boksoon executed targeted strike on ${target.name}`
    });
    addTestLog(res.message);
  };

  // 2. Mata Hari
  const testMataHariSteal = () => {
    let mataHari = p1.battlefield.find(c => c.specialAbility === 'mata_hari_steal_card');
    if (!mataHari) {
      spawnTestCardToP1({
        name: 'Mata Hari',
        type: 'Operative',
        cost: 4,
        off: 3,
        def: 3,
        sub: 3,
        isNamed: true,
        specialAbility: 'mata_hari_steal_card',
        abilityText: "Take a random card from target player's hand."
      });
      mataHari = p1.battlefield.find(c => c.specialAbility === 'mata_hari_steal_card')!;
    }
    if (p2.hand.length === 0) {
      p2.hand.push({ id: `p2_card_${Date.now()}`, name: 'Classified Intel', type: 'Support', cost: 2 });
      addTestLog("Added a test card to P2's hand.");
    }
    const res = engine.executeAction(p1, p2, {
      type: 'OPERATIVE_ACTION',
      card: mataHari,
      opType: 'mata_hari_steal',
      desc: "Mata Hari charm steal"
    });
    addTestLog(res.message);
  };

  // 3. Ghost
  const testGhostSiphon = () => {
    let ghost = p1.battlefield.find(c => c.specialAbility === 'ghost_siphon_2');
    if (!ghost) {
      spawnTestCardToP1({
        name: 'Ghost',
        type: 'Operative',
        cost: 4,
        off: 3,
        def: 3,
        raid: 3,
        isNamed: true,
        specialAbility: 'ghost_siphon_2',
        abilityText: 'Siphon 2 resources from opponent.'
      });
      ghost = p1.battlefield.find(c => c.specialAbility === 'ghost_siphon_2')!;
    }
    if (engine.getTotalSpendableCoins(p2) < 2) {
      p2.current_turn_coins += 3;
      addTestLog("Granted +3 coins to P2 so Ghost can siphon.");
    }
    const res = engine.executeAction(p1, p2, {
      type: 'OPERATIVE_ACTION',
      card: ghost,
      opType: 'ghost_siphon',
      desc: "Ghost cyber-siphon"
    });
    addTestLog(res.message);
  };

  // 4. Dan Weak
  const testDanWeakSacrifice = (choice: 'discard_hand' | 'discard_in_play') => {
    let danWeak = p1.battlefield.find(c => c.specialAbility === 'dan_weak_sacrifice');
    if (!danWeak) {
      spawnTestCardToP1({
        name: 'Dan Weak',
        type: 'Operative',
        cost: 5,
        off: 4,
        def: 4,
        ass: 2,
        sub: 2,
        isNamed: true,
        specialAbility: 'dan_weak_sacrifice',
        abilityText: 'Sacrifice from play to force discard hand or discard 2 cards in play.'
      });
      danWeak = p1.battlefield.find(c => c.specialAbility === 'dan_weak_sacrifice')!;
    }
    if (choice === 'discard_hand' && p2.hand.length === 0) {
      p2.hand.push({ id: `c1_${Date.now()}`, name: 'Coded Ledger', type: 'Support', cost: 1 });
      p2.hand.push({ id: `c2_${Date.now()}`, name: 'Field Radio', type: 'Support', cost: 2 });
      addTestLog("Added 2 cards to P2's hand for testing.");
    }
    if (choice === 'discard_in_play' && p2.battlefield.length < 2) {
      spawnTargetToP2(false);
      spawnTargetToP2(true);
    }
    const res = engine.executeAction(p1, p2, {
      type: 'DAN_WEAK_SACRIFICE',
      card: danWeak,
      subChoice: choice,
      desc: `Dan Weak sacrificed: ${choice}`
    });
    addTestLog(res.message);
  };

  // Locations: Armory, Troll Farm, Research Facility
  const testArmoryBuff = (targetOp: Card, choice: 'off' | 'def') => {
    let armory = p1.battlefield.find(c => c.specialAbility === 'armory_buff');
    if (!armory) {
      spawnTestCardToP1({
        name: 'Armory',
        type: 'Location',
        cost: 2,
        production: 1,
        cap: 1,
        specialAbility: 'armory_buff',
        abilityText: 'Tap: Give operative +1 Offense or +1 Defense.'
      });
      armory = p1.battlefield.find(c => c.specialAbility === 'armory_buff')!;
    }
    armory.exhausted = false;
    const res = engine.executeAction(p1, p2, {
      type: 'TAP_ABILITY',
      card: armory,
      targetCard: targetOp,
      subChoice: choice === 'off' ? 'buff_off' : 'buff_def',
      desc: `Armory gave +1 ${choice} to ${targetOp.name}`
    });
    addTestLog(res.message);
  };

  const testTrollFarm = () => {
    let troll = p1.battlefield.find(c => c.specialAbility === 'force_discard');
    if (!troll) {
      spawnTestCardToP1({
        name: 'Troll Farm',
        type: 'Location',
        cost: 2,
        production: 1,
        cap: 1,
        specialAbility: 'force_discard',
        abilityText: 'Tap: Force target player to discard a card.'
      });
      troll = p1.battlefield.find(c => c.specialAbility === 'force_discard')!;
    }
    troll.exhausted = false;
    if (p2.hand.length === 0) {
      p2.hand.push({ id: `c_troll_${Date.now()}`, name: 'Intercepted Wire', type: 'Support', cost: 1 });
      addTestLog("Added a card to P2 hand to discard.");
    }
    const res = engine.executeAction(p1, p2, {
      type: 'TAP_ABILITY',
      card: troll,
      desc: "Troll Farm forced discard"
    });
    addTestLog(res.message);
  };

  const testResearchFacility = () => {
    let resFac = p1.battlefield.find(c => c.specialAbility === 'draw_card');
    if (!resFac) {
      spawnTestCardToP1({
        name: 'Research Facility',
        type: 'Location',
        cost: 4,
        production: 3,
        cap: 3,
        specialAbility: 'draw_card',
        abilityText: 'Tap: Draw a card.'
      });
      resFac = p1.battlefield.find(c => c.specialAbility === 'draw_card')!;
    }
    resFac.exhausted = false;
    const res = engine.executeAction(p1, p2, {
      type: 'TAP_ABILITY',
      card: resFac,
      desc: "Research Facility draw"
    });
    addTestLog(res.message);
  };

  const testDiscardFirstCard = () => {
    if (p1.hand.length === 0) {
      addTestLog("Hand is empty, cannot discard.");
      return;
    }
    const card = p1.hand[0];
    const res = engine.executeAction(p1, p2, {
      type: 'DISCARD_CARD',
      cardId: card.id,
      cardName: card.name,
      card,
      desc: `Discard ${card.name}`
    });
    addTestLog(res.message);
  };

  // Defensive Intercept Simulation
  const simulateAttackWithDefense = (threatType: 'raid' | 'ass' | 'sub', defenderReady: boolean) => {
    // Setup defender operative on P2
    let defender = p2.battlefield.find(c => c.type === 'Operative');
    if (!defender) {
      const defCard: Card = {
        id: `def_${Date.now()}`,
        name: threatType === 'raid' ? 'Firewall Sentry (Raid 1)' : threatType === 'sub' ? 'Counter-Agent (Sub 1)' : 'Elite Bodyguard (Def 3)',
        type: 'Operative',
        cost: 2,
        off: 2,
        def: 3,
        ass: threatType === 'ass' ? 1 : 0,
        raid: threatType === 'raid' ? 1 : 0,
        sub: threatType === 'sub' ? 1 : 0,
        exhausted: !defenderReady
      };
      p2.battlefield.push(defCard);
      defender = defCard;
    } else {
      defender.exhausted = !defenderReady;
      if (threatType === 'raid') defender.raid = 1;
      if (threatType === 'ass') defender.ass = 1;
      if (threatType === 'sub') defender.sub = 1;
    }

    // Ensure relevant defensive mission is on table
    const misKey = threatType === 'raid' ? 'thwart_raid' : threatType === 'ass' ? 'thwart_ass' : 'thwart_sub';
    let mission = engine.missionsOnTable.find(m => m.type === misKey);
    if (!mission) {
      mission = {
        id: `mis_${misKey}`,
        name: threatType === 'raid' ? 'Firewall Expert' : threatType === 'ass' ? 'Expert Bodyguard' : 'Counterintelligence',
        type: misKey,
        req: 3,
        points: 3,
        tokens: { P1: 0, P2: 0 },
        description: `Thwart 3 ${threatType} attempts.`
      };
      engine.missionsOnTable.push(mission);
    }

    // Setup attacker on P1
    let attacker = p1.battlefield.find(c => c.type === 'Operative' && !c.exhausted);
    if (!attacker) {
      attacker = {
        id: `atk_${Date.now()}`,
        name: 'Infiltrator Strike Unit',
        type: 'Operative',
        cost: 3,
        off: 3,
        def: 2,
        ass: 1,
        raid: 2,
        sub: 2,
        exhausted: false
      };
      p1.battlefield.push(attacker);
    }

    // Give P2 coins/cards if needed for raid or sub
    if (threatType === 'raid') p2.current_turn_coins += 3;
    if (threatType === 'sub') p2.hand.push({ id: `c_${Date.now()}`, name: 'Sensitive Memo', type: 'Support', cost: 1 });

    const opTypeMap: Record<string, 'ass' | 'raid' | 'sub'> = { raid: 'raid', ass: 'ass', sub: 'sub' };
    const res = engine.executeAction(p1, p2, {
      type: 'OPERATIVE_ACTION',
      card: attacker,
      targetCard: defender,
      opType: opTypeMap[threatType],
      desc: `Testing ${threatType} attack against ${defenderReady ? 'READY' : 'EXHAUSTED'} defender`
    });

    addTestLog(`[Threat: ${threatType.toUpperCase()} | Defender: ${defenderReady ? 'READY (R)' : 'EXHAUSTED (E)'}] -> ${res.message}`);
  };

  // Global Dominion Plan Checklist
  const c1 = p1.telemetry.eliminatedEnemyOpThisTurn;
  const c2 = p1.telemetry.raidedCoinsThisTurn >= 4;
  const c3 = p1.telemetry.discardedCardFromHandThisTurn;
  const canAfford = engine.getTotalSpendableCoins(p1) >= 8;
  const allConditionsMet = c1 && c2 && c3 && canAfford;

  const fulfillCondition = (cond: number) => {
    if (cond === 1) {
      p1.telemetry.eliminatedEnemyOpThisTurn = true;
      addTestLog("Fulfilled Condition 1: Enemy operative marked eliminated this turn.");
    } else if (cond === 2) {
      p1.telemetry.raidedCoinsThisTurn += 4;
      addTestLog("Fulfilled Condition 2: Raided coins set to " + p1.telemetry.raidedCoinsThisTurn);
    } else if (cond === 3) {
      p1.telemetry.discardedCardFromHandThisTurn = true;
      addTestLog("Fulfilled Condition 3: Discarded card from hand marked fulfilled.");
    } else if (cond === 4) {
      p1.current_turn_coins += 8;
      addTestLog("Fulfilled Cost requirement: Added +8 spendable coins to P1.");
    } else if (cond === 99) {
      // Fulfill ALL
      p1.telemetry.eliminatedEnemyOpThisTurn = true;
      p1.telemetry.raidedCoinsThisTurn = 4;
      p1.telemetry.discardedCardFromHandThisTurn = true;
      p1.current_turn_coins = Math.max(p1.current_turn_coins, 8);
      addTestLog("⚡ Fulfilled ALL 3 Conditions + 8 Coins! Global Dominion Plan is now playable!");
    }
    onRefresh();
  };

  const playDominionCard = () => {
    let card = p1.hand.find(c => c.name === 'Global Dominion Plan');
    if (!card) {
      card = {
        id: `gdp_${Date.now()}`,
        name: 'Global Dominion Plan',
        type: 'Support',
        cost: 8,
        specialAbility: 'global_dominion_plan',
        abilityText: 'Playable only if you eliminated an enemy op, raided 4 coins, AND discarded a card from hand this turn. Immediate victory!'
      };
      p1.hand.push(card);
    }
    const res = engine.executeAction(p1, p2, {
      type: 'PLAY_CARD',
      card,
      desc: "Playing Global Dominion Plan"
    });
    addTestLog(res.message);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setSelectedSubTab('named')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedSubTab === 'named'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Skull className="w-3.5 h-3.5" />
          1. Named Operatives
        </button>
        <button
          onClick={() => setSelectedSubTab('locations')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedSubTab === 'locations'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          2. Locations (Armory, Troll Farm, Research)
        </button>
        <button
          onClick={() => setSelectedSubTab('defense')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedSubTab === 'defense'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          3. Defensive Intercepts
        </button>
        <button
          onClick={() => setSelectedSubTab('dominion')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedSubTab === 'dominion'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          4. Global Dominion Plan (3 Win Conditions)
        </button>
      </div>

      {/* SUB-TAB 1: NAMED OPERATIVES */}
      {selectedSubTab === 'named' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Boksoon Box */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Skull className="w-4 h-4 text-rose-400" />
                  Boksoon (Targeted Assassin Discard)
                </h3>
                <p className="text-xs text-zinc-400">
                  Ability: Discard an enemy operative in play with Assassin skill &ge; 1.
                </p>
              </div>
              <button
                onClick={() => spawnTestCardToP1({
                  name: 'Boksoon',
                  type: 'Operative',
                  cost: 4,
                  off: 4,
                  def: 3,
                  ass: 3,
                  isNamed: true,
                  specialAbility: 'boksoon_discard_ass1',
                  abilityText: 'Discard an enemy operative in play with Assassin skill 1.'
                })}
                className="px-2.5 py-1 text-xs font-medium rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 hover:bg-rose-900"
              >
                + Spawn Boksoon
              </button>
            </div>

            <div className="text-xs text-zinc-300 space-y-2">
              <div className="flex items-center gap-2">
                <span>Enemy Targets:</span>
                <button
                  onClick={() => spawnTargetToP2(true)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  + Spawn Assassin Target (Ass:1)
                </button>
                <button
                  onClick={() => spawnTargetToP2(false)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  + Spawn Rookie (Ass:0)
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {p2.battlefield.filter(c => c.type === 'Operative').map(target => (
                  <button
                    key={target.id}
                    onClick={() => testBoksoonExecute(target)}
                    className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                      (target.ass || 0) >= 1
                        ? 'bg-rose-600/30 border-rose-500/50 hover:bg-rose-600 text-rose-200'
                        : 'bg-zinc-800/40 border-zinc-700 text-zinc-500 cursor-not-allowed'
                    }`}
                    title={(target.ass || 0) >= 1 ? 'Execute Boksoon ability' : 'Invalid target: Requires Assassin >= 1'}
                  >
                    Execute: {target.name} (Ass: {target.ass || 0})
                  </button>
                ))}
                {p2.battlefield.filter(c => c.type === 'Operative').length === 0 && (
                  <span className="text-zinc-500 italic">No enemy operatives on P2 battlefield. Spawn one above.</span>
                )}
              </div>
            </div>
          </div>

          {/* Mata Hari Box */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Mata Hari (Hand Card Theft)
                </h3>
                <p className="text-xs text-zinc-400">
                  Ability: Steal 1 random card directly from target player's hand into your hand.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-300 py-1">
              <span>Opponent Hand Size: <span className="font-mono text-amber-400 font-bold">{p2.hand.length} cards</span></span>
              <span>Your Hand Size: <span className="font-mono text-emerald-400 font-bold">{p1.hand.length} cards</span></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={testMataHariSteal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Trigger Mata Hari Infiltration &amp; Steal
              </button>
              <button
                onClick={() => {
                  p2.hand.push({ id: `c_${Date.now()}`, name: 'Classified Document', type: 'Support', cost: 3 });
                  addTestLog("Added +1 test card to P2 hand.");
                }}
                className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                + Add Card to P2 Hand
              </button>
            </div>
          </div>

          {/* Ghost Box */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Ghost (Resource Siphon)
                </h3>
                <p className="text-xs text-zinc-400">
                  Ability: Siphons 2 resources from opponent upon deployment or activation.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-300 py-1">
              <span>P2 Spendable Coins: <span className="font-mono text-rose-400 font-bold">{engine.getTotalSpendableCoins(p2)}</span></span>
              <span>P1 Floating Pool: <span className="font-mono text-emerald-400 font-bold">{p1.current_turn_coins}</span></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={testGhostSiphon}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors"
              >
                Trigger Ghost Siphon (Steal 2 Coins)
              </button>
              <button
                onClick={() => {
                  p2.current_turn_coins += 4;
                  addTestLog("Added +4 coins to P2.");
                }}
                className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                + Add Coins to P2
              </button>
            </div>
          </div>

          {/* Dan Weak Box */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-red-400" />
                  Dan Weak (Dual Sacrifice)
                </h3>
                <p className="text-xs text-zinc-400">
                  Ability: Sacrificed from play to either force target to discard hand OR discard 2 cards in play.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => testDanWeakSacrifice('discard_hand')}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-red-600/30 border border-red-500/40 hover:bg-red-600 text-red-200 text-left transition-colors"
              >
                <div className="font-bold">Option A: Wipe Hand</div>
                <div className="text-[11px] opacity-80">Opponent discards full hand</div>
              </button>
              <button
                onClick={() => testDanWeakSacrifice('discard_in_play')}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-600/30 border border-amber-500/40 hover:bg-amber-600 text-amber-200 text-left transition-colors"
              >
                <div className="font-bold">Option B: Field Wipe</div>
                <div className="text-[11px] opacity-80">Opponent discards 2 cards in play</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LOCATIONS */}
      {selectedSubTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Armory */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Armory (+1 Off / +1 Def)
            </h3>
            <p className="text-xs text-zinc-400">
              Tap to give a target operative +1 Offense or +1 Defense for the turn.
            </p>

            <div className="space-y-2 pt-2">
              <div className="text-xs text-zinc-300">Choose friendly operative to buff:</div>
              {p1.battlefield.filter(c => c.type === 'Operative').map(op => (
                <div key={op.id} className="p-2 rounded bg-zinc-800/80 border border-zinc-700 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-100">{op.name}</div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      Off: {(op.off || 1) + (op.tempOffenseBuff || 0)} | Def: {(op.def || 1) + (op.tempDefenseBuff || 0)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => testArmoryBuff(op, 'off')}
                      className="px-2 py-1 rounded bg-red-950/80 text-red-300 border border-red-800/50 hover:bg-red-900 font-mono text-[11px]"
                    >
                      +1 Off
                    </button>
                    <button
                      onClick={() => testArmoryBuff(op, 'def')}
                      className="px-2 py-1 rounded bg-blue-950/80 text-blue-300 border border-blue-800/50 hover:bg-blue-900 font-mono text-[11px]"
                    >
                      +1 Def
                    </button>
                  </div>
                </div>
              ))}
              {p1.battlefield.filter(c => c.type === 'Operative').length === 0 && (
                <button
                  onClick={() => spawnTestCardToP1({ name: 'Rookie', type: 'Operative', off: 1, def: 1 })}
                  className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
                >
                  + Spawn Rookie Operative to Buff
                </button>
              )}
            </div>
          </div>

          {/* Troll Farm */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-purple-400" />
              Troll Farm (Force Discard)
            </h3>
            <p className="text-xs text-zinc-400">
              Tap to force target player to discard a card from hand.
            </p>

            <div className="text-xs text-zinc-300 py-2">
              Opponent Hand: <span className="font-mono text-amber-400 font-bold">{p2.hand.length} cards</span>
            </div>

            <button
              onClick={testTrollFarm}
              className="w-full py-2 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              Tap Troll Farm &rarr; Force Opponent Discard
            </button>
          </div>

          {/* Research Facility */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <h3 className="font-semibold text-zinc-100 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              Research Facility (Draw Card)
            </h3>
            <p className="text-xs text-zinc-400">
              Tap to draw a card from the unified draw deck.
            </p>

            <div className="text-xs text-zinc-300 py-2">
              Your Hand: <span className="font-mono text-emerald-400 font-bold">{p1.hand.length} / {engine.config.maxHandSize}</span> | Deck: <span className="font-mono text-zinc-400">{engine.drawDeck.length} cards</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={testResearchFacility}
                className="w-full py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Tap Facility &rarr; Draw 1 Card
              </button>
              <button
                onClick={testDiscardFirstCard}
                disabled={p1.hand.length === 0}
                className="w-full py-2 rounded-lg text-xs font-medium bg-rose-700 hover:bg-rose-600 text-white transition-colors disabled:opacity-50"
              >
                Discard 1st Card in Hand {p1.hand.length > engine.config.maxHandSize ? `(${p1.hand.length - engine.config.maxHandSize} excess)` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: DEFENSIVE INTERCEPTS */}
      {selectedSubTab === 'defense' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Defensive Mission Listeners &amp; Ready Intercept Simulation
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When an offensive operation is declared, the engine scans the defending player's battlefield for an eligible <strong>Ready (R)</strong> operative to intercept and thwart the attack.
              Exhausted (E) operatives cannot block! When thwarted, zero damage/stolen resources occur, and a physical token is placed on the respective table mission.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Firewall Expert */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-amber-300 font-mono uppercase">1. Firewall Expert</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Thwart Raid (3 pts)
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Ready operative with Raid skill &ge; 1 blocks enemy Raid.
              </p>
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => simulateAttackWithDefense('raid', true)}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-medium bg-emerald-600/30 border border-emerald-500/50 hover:bg-emerald-600 text-emerald-200 text-left transition-colors"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Defender READY (R)
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">Blocks raid &rarr; +1 Token on Firewall Expert</div>
                </button>
                <button
                  onClick={() => simulateAttackWithDefense('raid', false)}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-medium bg-red-950/40 border border-red-800/50 hover:bg-red-900 text-red-200 text-left transition-colors"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    Defender EXHAUSTED (E)
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">Cannot block &rarr; Raid succeeds</div>
                </button>
              </div>
            </div>

            {/* 2. Expert Bodyguard */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-rose-300 font-mono uppercase">2. Expert Bodyguard</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Thwart Ass (3 pts)
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Ready bodyguard intercepts strike aimed at friendly operative.
              </p>
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => simulateAttackWithDefense('ass', true)}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-medium bg-emerald-600/30 border border-emerald-500/50 hover:bg-emerald-600 text-emerald-200 text-left transition-colors"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Defender READY (R)
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">Blocks kill &rarr; +1 Token on Expert Bodyguard</div>
                </button>
                <button
                  onClick={() => simulateAttackWithDefense('ass', false)}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-medium bg-red-950/40 border border-red-800/50 hover:bg-red-900 text-red-200 text-left transition-colors"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    Defender EXHAUSTED (E)
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">Cannot block &rarr; Target operative destroyed</div>
                </button>
              </div>
            </div>

            {/* 3. Counterintelligence */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-purple-300 font-mono uppercase">3. Counterintel</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Thwart Sub (3 pts)
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Ready operative with Subterfuge &ge; 1 intercepts hand wipe attack.
              </p>
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => simulateAttackWithDefense('sub', true)}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-medium bg-emerald-600/30 border border-emerald-500/50 hover:bg-emerald-600 text-emerald-200 text-left transition-colors"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Defender READY (R)
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">Blocks discard &rarr; +1 Token on Counterintel</div>
                </button>
                <button
                  onClick={() => simulateAttackWithDefense('sub', false)}
                  className="w-full py-2 px-2.5 rounded-lg text-xs font-medium bg-red-950/40 border border-red-800/50 hover:bg-red-900 text-red-200 text-left transition-colors"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    Defender EXHAUSTED (E)
                  </div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">Cannot block &rarr; Hand cards discarded</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: GLOBAL DOMINION PLAN */}
      {selectedSubTab === 'dominion' && (
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Global Dominion Plan: Strict 3-Condition Validation
              </h3>
              <p className="text-xs text-zinc-400">
                Cost: 8 Coins. Playable ONLY if all 3 strict conditions are fulfilled in the active turn. Triggers instant match victory!
              </p>
            </div>
            <button
              onClick={() => fulfillCondition(99)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors"
            >
              ⚡ Fulfill All 3 Conditions Instantly
            </button>
          </div>

          {/* Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg border ${c1 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs font-mono">Condition 1</span>
                {c1 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-zinc-500" />}
              </div>
              <div className="text-xs">Eliminated enemy operative this turn</div>
              {!c1 && (
                <button
                  onClick={() => fulfillCondition(1)}
                  className="mt-2 text-[11px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                >
                  Mark Fulfilled
                </button>
              )}
            </div>

            <div className={`p-3 rounded-lg border ${c2 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs font-mono">Condition 2</span>
                {c2 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-zinc-500" />}
              </div>
              <div className="text-xs">Raided &ge; 4 coins this turn ({p1.telemetry.raidedCoinsThisTurn}/4)</div>
              {!c2 && (
                <button
                  onClick={() => fulfillCondition(2)}
                  className="mt-2 text-[11px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                >
                  Mark Fulfilled (+4)
                </button>
              )}
            </div>

            <div className={`p-3 rounded-lg border ${c3 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs font-mono">Condition 3</span>
                {c3 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-zinc-500" />}
              </div>
              <div className="text-xs">Discarded a card from hand this turn</div>
              {!c3 && (
                <button
                  onClick={() => fulfillCondition(3)}
                  className="mt-2 text-[11px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                >
                  Mark Fulfilled
                </button>
              )}
            </div>

            <div className={`p-3 rounded-lg border ${canAfford ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs font-mono">Cost: 8 Coins</span>
                {canAfford ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-zinc-500" />}
              </div>
              <div className="text-xs">Spendable Coins: {engine.getTotalSpendableCoins(p1)} / 8</div>
              {!canAfford && (
                <button
                  onClick={() => fulfillCondition(4)}
                  className="mt-2 text-[11px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                >
                  Add +8 Coins
                </button>
              )}
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <span className="text-xs font-mono text-zinc-300">
              Status: {allConditionsMet ? (
                <span className="text-emerald-400 font-bold">READY TO ENACT GLOBAL DOMINION</span>
              ) : (
                <span className="text-amber-400">Locked — Requirements not yet met</span>
              )}
            </span>
            <button
              onClick={playDominionCard}
              disabled={!allConditionsMet}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                allConditionsMet
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-black hover:opacity-90 shadow-lg shadow-amber-500/20 cursor-pointer animate-pulse'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
              }`}
            >
              Play Global Dominion Plan (Win Game)
            </button>
          </div>
        </div>
      )}

      {/* Real-time Test Output Console */}
      <div className="p-3 rounded-xl bg-black/70 border border-zinc-800 font-mono text-xs space-y-1">
        <div className="text-zinc-400 text-[11px] border-b border-zinc-800 pb-1 flex items-center justify-between">
          <span>Test Action Log Console</span>
          <button
            onClick={() => setTestLog([])}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            Clear Log
          </button>
        </div>
        <div className="max-h-28 overflow-y-auto space-y-0.5 pt-1">
          {testLog.length === 0 ? (
            <div className="text-zinc-600 italic">No actions executed yet. Click any test button above.</div>
          ) : (
            testLog.map((log, idx) => (
              <div key={idx} className="text-zinc-300 leading-snug">
                &gt; {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
