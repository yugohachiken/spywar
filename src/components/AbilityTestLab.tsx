import React, { useState } from 'react';
import { SpywarEngine } from '../engine/SpywarEngine';
import { CardView } from './CardView';
import { Card } from '../types/spywar';
import { ShieldCheck, Skull, Zap, Swords, Building2, Flame, Award, CheckCircle2, XCircle, Coins, Sparkles, Target } from 'lucide-react';

interface AbilityTestLabProps {
  engine: SpywarEngine;
  onRefresh: () => void;
}

export const AbilityTestLab: React.FC<AbilityTestLabProps> = ({ engine, onRefresh }) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'named' | 'locations' | 'defense' | 'dominion' | 'keywords'>('named');
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
        <button
          onClick={() => setSelectedSubTab('keywords')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedSubTab === 'keywords'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          5. Action Studio Keywords
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

      {/* SUB-TAB 5: ACTION STUDIO KEYWORDS */}
      {selectedSubTab === 'keywords' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-1">
            <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Action Studio Keywords Diagnostic Test Bench
            </h3>
            <p className="text-xs text-zinc-400">
              Interactive test suites verifying "Deploy x card_type", "Deploy any x", "Exhaust", "Intercept", "Interrupt", and "Discard at end of turn".
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Keyword 1: Deploy x card_type */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">1. Deploy x card_type</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Free deployment from hand</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Puts into play 1 or more cards from hand of a specific type without paying the card cost (Support, Operative, Location).
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={() => {
                    // Give P1 two high-cost Operatives in hand
                    const op1: Card = { id: `free_op1_${Date.now()}`, name: 'Elite Cybercommando', type: 'Operative', cost: 5, off: 4, def: 3 };
                    const op2: Card = { id: `free_op2_${Date.now()}`, name: 'Deep Cover Assassin', type: 'Operative', cost: 6, off: 5, def: 2 };
                    p1.hand.push(op1, op2);

                    // Card with ability "Tap: Deploy 2 Operative cards from your hand."
                    const spawner: Card = {
                      id: `deploy_op_${Date.now()}`,
                      name: 'SpecOps Air Drop',
                      type: 'Support',
                      cost: 0,
                      abilityText: 'Tap: Deploy 2 Operative cards from your hand.'
                    };
                    p1.battlefield.push(spawner);

                    const res = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: spawner,
                      dynamicAbilityEffect: {
                        abilityText: spawner.abilityText!,
                        effect: {
                          type: 'deploy_card',
                          deployCardType: 'Operative',
                          deployCount: 2,
                          amount: 2
                        },
                        trigger: 'tap',
                        requiresTap: true
                      },
                      desc: 'Tap: Deploy 2 Operative cards from your hand'
                    });
                    addTestLog(`🚀 [Deploy Operatives]: ${res.message}`);
                    addTestLog(`P1 Battlefield Operatives: ${p1.battlefield.filter(c => c.type === 'Operative').map(c => c.name).join(', ')}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Deploy 2 Operatives"</span>
                  <span className="text-[10px] font-mono opacity-80">Free Cost</span>
                </button>

                <button
                  onClick={() => {
                    const loc1: Card = { id: `free_loc1_${Date.now()}`, name: 'Orbital Fortress', type: 'Location', cost: 7, production: 3, cap: 3 };
                    p1.hand.push(loc1);
                    const spawner: Card = {
                      id: `deploy_loc_${Date.now()}`,
                      name: 'Rapid Engineering',
                      type: 'Support',
                      cost: 0,
                      abilityText: 'Tap: Deploy 1 Location card from your hand.'
                    };
                    p1.battlefield.push(spawner);

                    const res = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: spawner,
                      dynamicAbilityEffect: {
                        abilityText: spawner.abilityText!,
                        effect: {
                          type: 'deploy_card',
                          deployCardType: 'Location',
                          deployCount: 1,
                          amount: 1
                        },
                        trigger: 'tap',
                        requiresTap: true
                      },
                      desc: 'Tap: Deploy 1 Location card from your hand'
                    });
                    addTestLog(`🏗️ [Deploy Location]: ${res.message}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Deploy 1 Location"</span>
                  <span className="text-[10px] font-mono opacity-80">Free Cost</span>
                </button>
              </div>
            </div>

            {/* Keyword 1 Variation: Deploy any x */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">Variation: Deploy any x</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Any card type free</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Puts into play 1 or more cards of ANY type from hand without paying card cost.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => {
                    const c1: Card = { id: `any_c1_${Date.now()}`, name: 'Black Market Syndicate', type: 'Location', cost: 5, production: 2, cap: 2 };
                    const c2: Card = { id: `any_c2_${Date.now()}`, name: 'Master Infiltrator', type: 'Operative', cost: 4, off: 3, def: 3 };
                    p1.hand.push(c1, c2);

                    const spawner: Card = {
                      id: `deploy_any_${Date.now()}`,
                      name: 'Quantum Teleporter',
                      type: 'Support',
                      cost: 0,
                      abilityText: 'Tap: Deploy any 2 cards from your hand.'
                    };
                    p1.battlefield.push(spawner);

                    const res = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: spawner,
                      dynamicAbilityEffect: {
                        abilityText: spawner.abilityText!,
                        effect: {
                          type: 'deploy_card',
                          deployCardType: 'any',
                          deployCount: 2,
                          amount: 2
                        },
                        trigger: 'tap',
                        requiresTap: true
                      },
                      desc: 'Tap: Deploy any 2 cards from your hand'
                    });
                    addTestLog(`✨ [Deploy Any 2]: ${res.message}`);
                    addTestLog(`P1 In-Play: ${p1.battlefield.map(c => `${c.name} (${c.type})`).join(', ')}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Deploy any 2"</span>
                  <span className="text-[10px] font-mono opacity-80">Free Any</span>
                </button>
              </div>
            </div>

            {/* Keyword 2: Exhaust */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/40">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">2. Exhaust</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Disable opponent card</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Puts opponent's card into Exhaust condition to prevent it from producing resources or using special abilities.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => {
                    // Ensure P2 has an active ready operative
                    let enemy = p2.battlefield.find(c => !c.exhausted);
                    if (!enemy) {
                      enemy = {
                        id: `ready_enemy_${Date.now()}`,
                        name: 'Enemy Heavy Drone',
                        type: 'Operative',
                        cost: 3,
                        off: 3,
                        def: 3,
                        exhausted: false
                      };
                      p2.battlefield.push(enemy);
                    }

                    const taser: Card = {
                      id: `exhaust_card_${Date.now()}`,
                      name: 'EMP Disruptor',
                      type: 'Support',
                      cost: 0,
                      abilityText: "Tap: Exhaust 1 opponent's card."
                    };
                    p1.battlefield.push(taser);

                    const res = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: taser,
                      targetCard: enemy,
                      dynamicAbilityEffect: {
                        abilityText: taser.abilityText!,
                        effect: {
                          type: 'exhaust_card',
                          amount: 1,
                          exhaustCount: 1,
                          exhaustTargetType: 'card'
                        },
                        trigger: 'tap',
                        requiresTap: true
                      },
                      desc: `Tap: Exhaust ${enemy.name}`
                    });
                    addTestLog(`💤 [Exhaust Effect]: ${res.message}`);
                    addTestLog(`Enemy ${enemy.name} status: ${enemy.exhausted ? 'EXHAUSTED (Disabled)' : 'Ready'}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Exhaust Opponent Card"</span>
                  <span className="text-[10px] font-mono opacity-80">Disable</span>
                </button>
              </div>
            </div>

            {/* Keyword 3: Intercept */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">3. Intercept</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Defend against attacks</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Card can be deployed or use its special ability out of turn when attacked with a special ability or Operation.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => {
                    const interceptCard: Card = {
                      id: `intercept_${Date.now()}`,
                      name: 'Interceptor Guard',
                      type: 'Support',
                      cost: 1,
                      def: 3,
                      isIntercept: true,
                      abilityText: 'Intercept: Fortify defense by +3 DEF against incoming attack.'
                    };
                    p1.hand.push(interceptCard);

                    const res = engine.playDefensiveReactionCard(p1, interceptCard.id);
                    addTestLog(`🛡️ [Intercept Test]: ${res.message} (DEF Bonus: +${res.defBonus})`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Play Intercept Card"</span>
                  <span className="text-[10px] font-mono opacity-80">Reaction</span>
                </button>
              </div>
            </div>

            {/* Keyword 4: Interrupt */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">4. Interrupt</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Play anytime out-of-turn</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Can be played anytime, out of player's turn, even when not being attacked!
              </p>
              <div className="pt-1">
                <button
                  onClick={() => {
                    p1.current_turn_coins = Math.max(3, p1.current_turn_coins);
                    const interruptCard: Card = {
                      id: `interrupt_${Date.now()}`,
                      name: 'Sabotage Network',
                      type: 'Support',
                      cost: 1,
                      isInterrupt: true,
                      abilityText: 'Interrupt: Siphon 2 coins from Opponent.'
                    };
                    p1.hand.push(interruptCard);

                    const actions = engine.getInterruptActions(p1, p2);
                    addTestLog(`⚡ [Interrupt Query]: Found ${actions.length} valid interrupt action(s) for P1.`);

                    const res = engine.executeAction(p1, p2, {
                      type: 'INTERRUPT_ACTION',
                      card: interruptCard,
                      cardId: interruptCard.id,
                      cardName: interruptCard.name,
                      desc: `Interrupt: Play ${interruptCard.name} out-of-turn`
                    });
                    addTestLog(`⚡ [Interrupt Executed]: ${res.message}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-zinc-950 text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Trigger Interrupt Anytime"</span>
                  <span className="text-[10px] font-mono opacity-80">Out-of-Turn</span>
                </button>
              </div>
            </div>

            {/* Keyword 5: Discard at end of turn */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">5. Discard at end of turn</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Auto-discard cleanup</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Cards with this keyword are automatically discarded at the end of the player's turn.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => {
                    const tempCard: Card = {
                      id: `temp_drone_${Date.now()}`,
                      name: 'Temporary Assault Drone',
                      type: 'Operative',
                      cost: 1,
                      off: 3,
                      def: 1,
                      discardAtEndOfTurn: true,
                      abilityText: 'Deploy: +1 OFF. Discard at end of turn.'
                    };
                    p1.battlefield.push(tempCard);
                    addTestLog(`Deployed ${tempCard.name} with [Discard at end of turn] to P1 battlefield.`);

                    // Trigger pass turn to test auto-discard
                    engine.passTurn();
                    const stillInPlay = p1.battlefield.some(c => c.id === tempCard.id);
                    const inDiscard = p1.discard_pile.some(c => c.id === tempCard.id);
                    addTestLog(`⏳ [End of Turn Test]: In play: ${stillInPlay ? 'YES' : 'NO'}, Discarded: ${inDiscard ? 'YES (Auto-discarded!)' : 'NO'}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Discard at end of turn"</span>
                  <span className="text-[10px] font-mono opacity-80">Auto Cleanup</span>
                </button>
              </div>
            </div>

            {/* Keyword 6: Studio Action Tokens (+x/+x Weapon, Suit, Armor, Power Suit, Discard token) */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">6. Studio Action Tokens</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Weapon, Suit, Armor, Discard</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Places Weapon, Suit, Powered armor, Power Suit (+x/+x), or Discard token. Disallows stacking duplicate tokens. Discard token card is discarded at turn end.
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={() => {
                    const targetOp: Card = { id: `token_target_${Date.now()}`, name: 'Vanguard Operative', type: 'Operative', cost: 0, off: 2, def: 2 };
                    p1.battlefield.push(targetOp);

                    const bufferCard: Card = {
                      id: `buff_src_${Date.now()}`,
                      name: 'Armory Requisition',
                      type: 'Support',
                      cost: 0,
                      abilityText: 'Tap: Give target friendly operative +1/+1 Weapon token.'
                    };
                    p1.battlefield.push(bufferCard);

                    // 1. Grant Weapon token
                    const res1 = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: bufferCard,
                      targetCard: targetOp,
                      targetId: targetOp.id,
                      targetName: targetOp.name,
                      subChoice: 'token_weapon',
                      dynamicAbilityEffect: {
                        abilityText: bufferCard.abilityText!,
                        effect: { type: 'grant_token', tokenType: 'weapon', amount: 1, stat: 'both' }
                      }
                    });
                    addTestLog(`🗡️ [Grant Weapon Token]: ${res1.message} (Weapon tokens: ${targetOp.weaponTokens})`);

                    // 2. Test duplicate stacking prevention (should fail)
                    const resDup = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: bufferCard,
                      targetCard: targetOp,
                      targetId: targetOp.id,
                      targetName: targetOp.name,
                      subChoice: 'token_weapon',
                      dynamicAbilityEffect: {
                        abilityText: bufferCard.abilityText!,
                        effect: { type: 'grant_token', tokenType: 'weapon', amount: 1, stat: 'both' }
                      }
                    });
                    addTestLog(`🚫 [Stacking Duplicate Check]: ${resDup.message} (Success: ${resDup.success})`);

                    // 3. Grant Discard token
                    const resDiscardToken = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: bufferCard,
                      targetCard: targetOp,
                      targetId: targetOp.id,
                      targetName: targetOp.name,
                      subChoice: 'token_discard',
                      dynamicAbilityEffect: {
                        abilityText: 'Tap: Place Discard token on target card.',
                        effect: { type: 'grant_token', tokenType: 'discard', amount: 1 }
                      }
                    });
                    addTestLog(`⏳ [Grant Discard Token]: ${resDiscardToken.message}`);

                    // 4. Test end of turn cleanup with Discard token
                    engine.passTurn();
                    const stillInPlay = p1.battlefield.some(c => c.id === targetOp.id);
                    const inDiscard = p1.discard_pile.some(c => c.id === targetOp.id);
                    addTestLog(`⏳ [Discard Token Turn End]: In play: ${stillInPlay ? 'YES' : 'NO'}, In Discard Pile: ${inDiscard ? 'YES (Cleaned up!)' : 'NO'}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Weapon &amp; Discard Tokens"</span>
                  <span className="text-[10px] font-mono opacity-80">Tokens</span>
                </button>
              </div>
            </div>

            {/* Keyword 7: Opponent Discard Keywords */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">7. Opponent Discard Keywords</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Hand &amp; Battlefield Discard</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                "Discard x card in play" and "Discard x card from hand" force opponent to discard from field or hand.
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={() => {
                    // Seed opponent hand and field
                    const oppCardInPlay: Card = { id: `opp_b_${Date.now()}`, name: 'Enemy Outpost', type: 'Location', cost: 0 };
                    const oppCardInHand: Card = { id: `opp_h_${Date.now()}`, name: 'Enemy Secret Orders', type: 'Support', cost: 0 };
                    p2.battlefield.push(oppCardInPlay);
                    p2.hand.push(oppCardInHand);

                    const disruptor: Card = {
                      id: `disrupt_${Date.now()}`,
                      name: 'Infiltration Team',
                      type: 'Support',
                      cost: 0,
                      abilityText: 'Tap: Discard 1 card in play.'
                    };
                    p1.battlefield.push(disruptor);

                    // Test Discard 1 card in play
                    const resField = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: disruptor,
                      targetCard: oppCardInPlay,
                      targetId: oppCardInPlay.id,
                      targetName: oppCardInPlay.name,
                      dynamicAbilityEffect: {
                        abilityText: 'Tap: Discard 1 card in play.',
                        effect: { type: 'discard_field', amount: 1 }
                      }
                    });
                    addTestLog(`💥 [Discard card in play]: ${resField.message}`);
                    addTestLog(`P2 Battlefield has ${oppCardInPlay.name}: ${p2.battlefield.some(c => c.id === oppCardInPlay.id) ? 'YES' : 'NO (Discarded!)'}`);

                    // Test Discard 1 card from hand
                    const resHand = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: disruptor,
                      dynamicAbilityEffect: {
                        abilityText: 'Tap: Discard 1 card from hand.',
                        effect: { type: 'discard_hand', amount: 1 }
                      }
                    });
                    addTestLog(`✋ [Discard card from hand]: ${resHand.message}`);
                    addTestLog(`P2 Hand count: ${p2.hand.length}, P2 Discard pile: ${p2.discard_pile.map(c => c.name).join(', ')}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Discard Field &amp; Hand"</span>
                  <span className="text-[10px] font-mono opacity-80">Opponent</span>
                </button>
              </div>
            </div>

            {/* Keyword 8: Gain Resource & Discard Cost Conversion */}
            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100">8. Gain Resource &amp; Discard Conversion</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Gain x Resource / Discard Cost Equal</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                "Gain x resource" &amp; "Gain x resource equal to discarded card cost" (e.g. Tap: Discards 1 card from hand, gain x resource equal to discarded card).
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  onClick={() => {
                    // Clean up prior test artifacts
                    p1.battlefield = p1.battlefield.filter(c => !c.id.startsWith('res_gen_') && !c.id.startsWith('converter_'));
                    p1.hand = p1.hand.filter(c => !c.id.startsWith('card_discard_'));
                    if (p1.hand.length >= engine.config.maxHandSize) {
                      p1.hand = p1.hand.slice(0, 2);
                    }

                    const startCoins = p1.current_turn_coins;
                    const resGenCard: Card = {
                      id: `res_gen_${Date.now()}`,
                      name: 'Aether Refinery',
                      type: 'Location',
                      cost: 0,
                      abilityText: 'Tap: Gain 3 resources.'
                    };
                    p1.battlefield.push(resGenCard);

                    // 1. Test Fixed Resource Gain
                    const resFixed = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: resGenCard,
                      dynamicAbilityEffect: {
                        abilityText: 'Tap: Gain 3 resources.',
                        effect: { type: 'gain_resource', amount: 3 }
                      }
                    });
                    addTestLog(`💎 [Gain 3 Resources]: ${resFixed.message} (Coins: ${startCoins} -> ${p1.current_turn_coins})`);

                    // 2. Test "Discards 1 card from hand, gain x resource equal to discarded card"
                    const cardToDiscard: Card = {
                      id: `card_discard_${Date.now()}`,
                      name: 'Advanced Orbital Prototype',
                      type: 'Support',
                      cost: 3
                    };
                    p1.hand.push(cardToDiscard);

                    const converterCard: Card = {
                      id: `converter_${Date.now()}`,
                      name: 'Scrap Recycler',
                      type: 'Support',
                      cost: 0,
                      abilityText: 'Tap: Discards 1 card from hand, gain x resource equal to discarded card.'
                    };
                    p1.battlefield.push(converterCard);

                    const coinsBeforeDiscard = p1.current_turn_coins;
                    const resDiscardCost = engine.executeAction(p1, p2, {
                      type: 'DYNAMIC_ABILITY',
                      card: converterCard,
                      targetCard: cardToDiscard,
                      targetId: cardToDiscard.id,
                      targetName: cardToDiscard.name,
                      dynamicAbilityEffect: {
                        abilityText: 'Tap: Discards 1 card from hand, gain x resource equal to discarded card.',
                        effect: { type: 'gain_resource_discard_cost', amount: 1 }
                      }
                    });

                    const inDiscardPile = p1.discard_pile.some(c => c.id === cardToDiscard.id);
                    const stillInHand = p1.hand.some(c => c.id === cardToDiscard.id);

                    addTestLog(`♻️ [Discard for Cost Resources]: ${resDiscardCost.message}`);
                    addTestLog(`Coins: ${coinsBeforeDiscard} -> ${p1.current_turn_coins} (+${cardToDiscard.cost} gained). In Discard: ${inDiscardPile ? 'YES' : 'NO'}, In Hand: ${stillInHand ? 'YES' : 'NO (Discarded)'}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Gain Resources &amp; Discard Conversion"</span>
                  <span className="text-[10px] font-mono opacity-80">Resources</span>
                </button>
              </div>
            </div>

            {/* Test Case 9: Passive Operative Cost Discount */}
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-teal-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-teal-300 text-xs flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-teal-400" />
                  <span>Case 9: Passive: Operative cost 1 less resource to deploy</span>
                </span>
                <span className="text-[10px] text-teal-400 font-mono">Continuous Passive</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Card in play grants a permanent -1 resource discount when deploying friendly Operatives without needing to tap. (e.g. 3-cost Operative deploys for 2 coins).
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // 0. Clean up prior test instances so clicking repeatedly doesn't stack locations or flood hand
                    p1.battlefield = p1.battlefield.filter(c => !c.id.startsWith('discount_card_') && !c.id.startsWith('heavy_op_'));
                    p1.hand = p1.hand.filter(c => !c.id.startsWith('heavy_op_') && !c.id.startsWith('card_discard_'));
                    if (p1.hand.length >= engine.config.maxHandSize) {
                      p1.hand = p1.hand.slice(0, 2);
                    }

                    // 1. Spawn Headquarters with passive discount to P1 battlefield (exactly 1 copy)
                    const discountCard: Card = {
                      id: `discount_card_${Date.now()}`,
                      name: 'Advanced Ops Center',
                      type: 'Location',
                      cost: 2,
                      exhausted: false,
                      stored_coins: 0,
                      abilityText: 'Passive: Operative cost 1 less resource to deploy.'
                    };
                    p1.battlefield.push(discountCard);

                    // 2. Put an Operative with base cost 3 into P1's hand
                    const heavyOp: Card = {
                      id: `heavy_op_${Date.now()}`,
                      name: 'Cybernetic Specialist',
                      type: 'Operative',
                      cost: 3,
                      off: 3,
                      def: 3,
                      exhausted: false
                    };
                    p1.hand.push(heavyOp);

                    // 3. Set P1 coins to 2 (normally cannot afford cost 3)
                    p1.current_turn_coins = 2;

                    // 4. Calculate effective deploy cost
                    const effCost = engine.getCardDeployCost(p1, heavyOp);
                    const discount = engine.getCardDeployDiscount(p1, heavyOp);

                    addTestLog(`🏷️ [Passive Discount Setup]: 1x ${discountCard.name} in play with: "${discountCard.abilityText}"`);
                    addTestLog(`Hand Card: ${heavyOp.name} (Base Cost: ${heavyOp.cost}). Effective Cost: ${effCost} (Discount: -${discount}). P1 Coins: ${p1.current_turn_coins}. Hand: ${p1.hand.length}/${engine.config.maxHandSize}`);

                    // 5. Deploy the card using PLAY_CARD
                    const playResult = engine.executeAction(p1, p2, {
                      type: 'PLAY_CARD',
                      cardId: heavyOp.id,
                      cardName: heavyOp.name,
                      card: heavyOp
                    });

                    const deployedOnField = p1.battlefield.some(c => c.id === heavyOp.id);
                    addTestLog(`🚀 [Deploy Result]: ${playResult.message}`);
                    addTestLog(`P1 Coins Remaining: ${p1.current_turn_coins} (Expected: 0). Deployed: ${deployedOnField ? 'SUCCESS (On Field)' : 'FAILED'}`);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Passive: Operative cost 1 less resource to deploy"</span>
                  <span className="text-[10px] font-mono opacity-80">Passive Discount</span>
                </button>
              </div>
            </div>

            {/* Case 10: Targeted Operative Buff Selection (Assassination Training & M.I.C.A. +1/+1 Tech Token) */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-emerald-500/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Case 10: Targeted Operative Buff Selection (Training &amp; M.I.C.A.)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Target Selection</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                When playing a card or ability that buffs an Operative (Assassination Training, Subterfuge Training, Raid Training, or M.I.C.A. +1/+1 Tech token), the player selects which Operative in play receives the benefit. Duplicate Tech tokens cannot stack.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    // Clean up test cards
                    p1.battlefield = p1.battlefield.filter(c => !c.id.startsWith('test_target_op_'));
                    p1.hand = p1.hand.filter(c => !c.id.startsWith('test_train_card_'));

                    // 1. Spawn two distinct operatives in play
                    const opAlpha: Card = {
                      id: `test_target_op_alpha_${Date.now()}`,
                      name: 'Operative Alpha (Infiltrator)',
                      type: 'Operative',
                      cost: 2,
                      off: 2,
                      def: 2,
                      ass: 0,
                      raid: 0,
                      sub: 0,
                      exhausted: false
                    };
                    const opBeta: Card = {
                      id: `test_target_op_beta_${Date.now()}`,
                      name: 'Operative Beta (Specialist)',
                      type: 'Operative',
                      cost: 3,
                      off: 3,
                      def: 3,
                      ass: 0,
                      raid: 0,
                      sub: 0,
                      exhausted: false
                    };
                    p1.battlefield.push(opAlpha, opBeta);

                    // 2. Spawn Assassination Training in hand
                    const assTraining: Card = {
                      id: `test_train_card_${Date.now()}`,
                      name: 'Assassination Training',
                      type: 'Support',
                      cost: 2,
                      abilityText: 'Cast: Target friendly operative gains +2 Assassin skill.'
                    };
                    p1.hand.push(assTraining);
                    p1.current_turn_coins = 5;

                    addTestLog(`🎯 [Setup]: Battlefield has 2 Operatives: "${opAlpha.name}" (ASS: 0) and "${opBeta.name}" (ASS: 0)`);

                    // 3. Play Assassination Training explicitly selecting Operative Beta as beneficiary
                    const playResult = engine.executeAction(p1, p2, {
                      type: 'PLAY_CARD',
                      cardId: assTraining.id,
                      cardName: assTraining.name,
                      card: assTraining,
                      targetId: opBeta.id,
                      targetName: opBeta.name,
                      targetCard: opBeta
                    });

                    addTestLog(`🚀 [Train Result]: ${playResult.message}`);
                    addTestLog(`🔍 [Target Verification]: ${opBeta.name} ASS=${opBeta.ass || 0} (Expected: 2) | ${opAlpha.name} ASS=${opAlpha.ass || 0} (Expected: 0)`);
                    const isSuccess = (opBeta.ass === 2) && (!opAlpha.ass || opAlpha.ass === 0);
                    addTestLog(`✅ [Assassination Training Targeted Buff]: ${isSuccess ? 'PASSED - Only selected Operative received +2 ASS' : 'FAILED'}`);
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "Assassination Training &rarr; Target Operative Beta"</span>
                  <span className="text-[10px] font-mono opacity-80">+2 ASS</span>
                </button>

                <button
                  onClick={() => {
                    // Clean up test cards
                    p1.battlefield = p1.battlefield.filter(c => !c.id.startsWith('test_target_op_'));

                    // 1. Spawn two distinct operatives in play
                    const opAlpha: Card = {
                      id: `test_target_op_alpha_${Date.now()}`,
                      name: 'Operative Alpha (Infiltrator)',
                      type: 'Operative',
                      cost: 2,
                      off: 2,
                      def: 2,
                      exhausted: false
                    };
                    const opBeta: Card = {
                      id: `test_target_op_beta_${Date.now()}`,
                      name: 'Operative Beta (Specialist)',
                      type: 'Operative',
                      cost: 3,
                      off: 3,
                      def: 3,
                      exhausted: false
                    };
                    p1.battlefield.push(opAlpha, opBeta);

                    // 2. Set P1 Affiliation to M.I.C.A.
                    const micaAffiliation: Card = {
                      id: `aff_mica_test_${Date.now()}`,
                      name: 'M.I.C.A.',
                      type: 'Affiliation',
                      cost: 0,
                      production: 2,
                      cap: 5,
                      specialAbility: 'buff_tech_token',
                      abilityText: 'Tap: Give target friendly operative +1/+1 Tech token.',
                      exhausted: false
                    };
                    p1.affiliation = micaAffiliation;

                    addTestLog(`🏷️ [M.I.C.A. Setup]: Affiliation set to M.I.C.A. Friendly Operatives: "${opAlpha.name}" (2/2) & "${opBeta.name}" (3/3)`);

                    // 3. Tap M.I.C.A. selecting Operative Alpha to receive +1/+1 Tech token
                    const tapResult = engine.executeAction(p1, p2, {
                      type: 'TAP_ABILITY',
                      cardId: micaAffiliation.id,
                      cardName: micaAffiliation.name,
                      card: micaAffiliation,
                      targetId: opAlpha.id,
                      targetName: opAlpha.name,
                      targetCard: opAlpha,
                      subChoice: 'buff_tech_token'
                    });

                    const effOffAlpha = (opAlpha.off || 0) + engine.getCardStatTokensBuff(opAlpha);
                    const effDefAlpha = (opAlpha.def || 0) + engine.getCardStatTokensBuff(opAlpha);
                    const effOffBeta = (opBeta.off || 0) + engine.getCardStatTokensBuff(opBeta);

                    addTestLog(`🚀 [M.I.C.A. Tap Result]: ${tapResult.message}`);
                    addTestLog(`🔍 [Token Verification]: ${opAlpha.name} Tech Tokens=${opAlpha.techTokens || 0} (OFF: ${effOffAlpha}, DEF: ${effDefAlpha}) | ${opBeta.name} Tech Tokens=${opBeta.techTokens || 0} (OFF: ${effOffBeta})`);

                    // 4. Test duplicate prevention: Attempting to give Operative Alpha another Tech token
                    micaAffiliation.exhausted = false; // Ready for duplicate test
                    const duplicateResult = engine.executeAction(p1, p2, {
                      type: 'TAP_ABILITY',
                      cardId: micaAffiliation.id,
                      cardName: micaAffiliation.name,
                      card: micaAffiliation,
                      targetId: opAlpha.id,
                      targetName: opAlpha.name,
                      targetCard: opAlpha,
                      subChoice: 'buff_tech_token'
                    });

                    addTestLog(`🛡️ [Duplicate Stack Prevention Result]: Success=${duplicateResult.success} -> "${duplicateResult.message}"`);
                    const isSuccess = (opAlpha.techTokens === 1) && (!opBeta.techTokens || opBeta.techTokens === 0) && (!duplicateResult.success);
                    addTestLog(`✅ [M.I.C.A. Targeted Tech Token & No Stacking]: ${isSuccess ? 'PASSED' : 'FAILED'}`);
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors text-left flex items-center justify-between"
                >
                  <span>Test "M.I.C.A. Tap &rarr; Target Operative Alpha (+1/+1 Tech)"</span>
                  <span className="text-[10px] font-mono opacity-80">+1/+1 Tech</span>
                </button>
              </div>
            </div>
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
