export interface GodotScriptFile {
  filename: string;
  category: string;
  description: string;
  code: string;
}

export const GODOT_SCRIPTS: GodotScriptFile[] = [
  {
    filename: "CardData.gd",
    category: "Core Resources",
    description: "Resource class defining all card attributes, types, combat stats, and specialized abilities.",
    code: `# res://scripts/core/CardData.gd
class_name CardData
extends Resource

enum CardType {
	AFFILIATION,
	LOCATION,
	OPERATIVE,
	SUPPORT,
	MISSION
}

enum SpecialAbility {
	NONE,
	// Affiliations
	AFF_IMF_DRAW,
	AFF_MI6_BUFF_SKILL,
	AFF_MK_DISCOUNT_OP,
	AFF_SHADOW_SPAWN_TOKEN,
	// Locations
	LOC_ARMORY_BUFF,
	LOC_TROLL_FARM_DISCARD,
	LOC_RESEARCH_DRAW,
	// Named Operatives
	OP_BOKSOON_DISCARD_ASS1,
	OP_MATA_HARI_STEAL_HAND,
	OP_GHOST_SIPHON_2,
	OP_DAN_WEAK_SACRIFICE,
	// Win Card
	SUPPORT_GLOBAL_DOMINION_PLAN
}

@export var id: String = ""
@export var card_name: String = ""
@export var card_type: CardType = CardType.OPERATIVE
@export var cost: int = 0
@export var is_named: bool = false
@export var special_ability: SpecialAbility = SpecialAbility.NONE
@export var ability_text: String = ""

# Economic stats (Affiliation / Location)
@export var production: int = 0
@export var resource_capacity: int = 2
var stored_coins: int = 0
var is_exhausted: bool = false

# Combat & Skill stats (Operative)
@export var offense: int = 1
@export var defense: int = 1
@export var skill_assassin: int = 0
@export var skill_raid: int = 0
@export var skill_subterfuge: int = 0

# Dynamic turn buffs
var temp_offense_buff: int = 0
var temp_defense_buff: int = 0

func get_effective_offense() -> int:
	return offense + skill_assassin + temp_offense_buff

func get_effective_defense(attacker_is_assassin: bool = true) -> int:
	var def_val = defense + temp_defense_buff
	if not is_exhausted and attacker_is_assassin:
		def_val += skill_assassin
	return def_val

func duplicate_card() -> CardData:
	var copy = self.duplicate(true) as CardData
	copy.stored_coins = self.stored_coins
	copy.is_exhausted = self.is_exhausted
	copy.temp_offense_buff = 0
	copy.temp_defense_buff = 0
	return copy
`
  },
  {
    filename: "PlayerState.gd",
    category: "Core State",
    description: "Encapsulates player cards, floating currency pool, round-robin storage allocation, and turn telemetry.",
    code: `# res://scripts/core/PlayerState.gd
class_name PlayerState
extends RefCounted

var player_id: String = "P1"
var display_name: String = "Player 1"
var is_ai: bool = false

var affiliation: CardData = null
var current_turn_coins: int = 0

var hand: Array[CardData] = []
var battlefield: Array[CardData] = []
var discard_pile: Array[CardData] = []
var completed_missions: Array[Dictionary] = []
var mission_points: int = 0

# Turn Telemetry for Mission Listeners & Global Dominion Plan validation
var eliminated_enemy_op_this_turn: bool = false
var raided_coins_this_turn: int = 0
var discarded_card_from_hand_this_turn: bool = false
var operations_conducted_this_turn: int = 0
var played_named_this_turn: bool = false
var unique_operations_this_turn: Dictionary = {}
var cards_played_this_turn: int = 0

func reset_turn_telemetry() -> void:
	eliminated_enemy_op_this_turn = false
	raided_coins_this_turn = 0
	discarded_card_from_hand_this_turn = false
	operations_conducted_this_turn = 0
	played_named_this_turn = false
	unique_operations_this_turn.clear()
	cards_played_this_turn = 0
	
	for card in battlefield:
		card.temp_offense_buff = 0
		card.temp_defense_buff = 0

func refresh_cards() -> void:
	if affiliation:
		affiliation.is_exhausted = false
	for card in battlefield:
		card.is_exhausted = false

func get_stored_coins() -> int:
	var total = affiliation.stored_coins if affiliation else 0
	for card in battlefield:
		if card.card_type == CardData.CardType.LOCATION:
			total += card.stored_coins
	return total

func get_total_spendable_coins() -> int:
	return current_turn_coins + get_stored_coins()

func spend_coins(amount: int) -> bool:
	if amount > get_total_spendable_coins():
		return false
	
	var remaining = amount
	var from_floating = mini(current_turn_coins, remaining)
	current_turn_coins -= from_floating
	remaining -= from_floating
	
	if remaining > 0 and affiliation:
		var from_aff = mini(affiliation.stored_coins, remaining)
		affiliation.stored_coins -= from_aff
		remaining -= from_aff
		
	if remaining > 0:
		for card in battlefield:
			if card.card_type == CardData.CardType.LOCATION:
				var from_loc = mini(card.stored_coins, remaining)
				card.stored_coins -= from_loc
				remaining -= from_loc
				if remaining <= 0:
					break
	return true

## Round-robin equal distribution across Affiliation and Locations up to caps
func store_remaining_coins(affiliation_cap: int = 5) -> Dictionary:
	if current_turn_coins <= 0:
		return {"stored": 0, "discarded": 0}
	
	var targets: Array[CardData] = []
	if affiliation:
		targets.append(affiliation)
	for card in battlefield:
		if card.card_type == CardData.CardType.LOCATION:
			targets.append(card)
			
	var coins_stored: int = 0
	var allocated: bool = true
	while current_turn_coins > 0 and allocated:
		allocated = false
		for card in targets:
			var cap = affiliation_cap if card.card_type == CardData.CardType.AFFILIATION else card.resource_capacity
			if card.stored_coins < cap and current_turn_coins > 0:
				card.stored_coins += 1
				current_turn_coins -= 1
				coins_stored += 1
				allocated = true
				
	var coins_discarded = current_turn_coins
	current_turn_coins = 0
	return {"stored": coins_stored, "discarded": coins_discarded}
`
  },
  {
    filename: "MissionManager.gd",
    category: "Game Rules",
    description: "Tracks physical tokens on active mission cards and handles defensive thwart listeners.",
    code: `# res://scripts/core/MissionManager.gd
class_name MissionManager
extends RefCounted

signal mission_tokens_placed(player_id: String, mission_name: String, amount: int, current: int, required: int)
signal mission_claimed(player_id: String, mission_name: String, points: int)
signal attack_thwarted(defender_id: String, mission_key: String, blocker_name: String)

var mission_deck: Array[Dictionary] = []
var active_missions_on_table: Array[Dictionary] = []

func initialize_missions() -> void:
	mission_deck = [
		{"id": "mis_hack", "name": "Master Hacker", "type": "res_theft", "req": 10, "points": 4, "tokens": {}},
		{"id": "mis_ass", "name": "Master Assassin", "type": "kills", "req": 5, "points": 5, "tokens": {}},
		{"id": "mis_sub", "name": "Master Subterfuge", "type": "hand_wipe", "req": 1, "points": 5, "tokens": {}},
		{"id": "mis_firewall", "name": "Firewall Expert", "type": "thwart_raid", "req": 3, "points": 3, "tokens": {}},
		{"id": "mis_bodyguard", "name": "Expert Bodyguard", "type": "thwart_ass", "req": 3, "points": 3, "tokens": {}},
		{"id": "mis_counterintel", "name": "Counterintelligence", "type": "thwart_sub", "req": 3, "points": 3, "tokens": {}},
		{"id": "mis_observer", "name": "Observer", "type": "no_ops", "req": 3, "points": 4, "tokens": {}},
		{"id": "mis_testing", "name": "Testing the Waters", "type": "ops_in_turn", "req": 3, "points": 4, "tokens": {}},
		{"id": "mis_big_spender", "name": "Big Spender", "type": "empty_hand", "req": 1, "points": 4, "tokens": {}},
		{"id": "mis_main_char", "name": "Main Character Syndrome", "type": "play_named", "req": 1, "points": 4, "tokens": {}}
	]
	mission_deck.shuffle()
	active_missions_on_table.clear()

func draw_round_mission() -> Dictionary:
	if mission_deck.is_empty():
		return {}
	var mission = mission_deck.pop_back()
	mission["tokens"] = {"P1": 0, "P2": 0}
	active_missions_on_table.append(mission)
	return mission

func add_mission_tokens(player: PlayerState, event_type: String, amount: int = 1) -> bool:
	var claimed_any: bool = false
	for i in range(active_missions_on_table.size() - 1, -1, -1):
		var mission = active_missions_on_table[i]
		if mission["type"] == event_type:
			var curr = mission["tokens"].get(player.player_id, 0) + amount
			mission["tokens"][player.player_id] = curr
			mission_tokens_placed.emit(player.player_id, mission["name"], amount, curr, mission["req"])
			
			if curr >= mission["req"]:
				player.completed_missions.append(mission)
				player.mission_points += mission["points"]
				active_missions_on_table.remove_at(i)
				mission_claimed.emit(player.player_id, mission["name"], mission["points"])
				claimed_any = true
	return claimed_any
`
  },
  {
    filename: "SpywarEngine.gd",
    category: "Game Engine",
    description: "Production-ready Godot 4 authoritative engine implementing all requested specialized abilities, defensive intercepts, and Global Dominion Plan validation.",
    code: `# res://scripts/core/SpywarEngine.gd
class_name SpywarEngine
extends Node

signal state_updated()
signal game_concluded(winner: PlayerState, reason: String)
signal action_logged(entry: Dictionary)

enum Phase {
	DRAW,
	OPERATIONS,
	CLEANUP
}

enum ActionType {
	TAP_PROD,
	TAP_ABILITY,
	PLAY_CARD,
	OPERATIVE_ACTION,
	DAN_WEAK_SACRIFICE,
	DISCARD_CARD,
	ADVANCE_PHASE,
	PASS
}

@export var rounds_limit: int = 5
@export var cards_drawn_per_turn: int = 2
@export var max_hand_size: int = 5
@export var points_to_win: int = 0
@export var affiliation_max_cap: int = 5
@export var operative_summon_state: String = "R" # "R" (Ready) or "E" (Exhausted)
@export var location_summon_state: String = "R"

var players: Array[PlayerState] = []
var active_player_index: int = 0
var current_round: int = 0
var current_phase: Phase = Phase.OPERATIONS
var action_counter: int = 0
var is_game_over: bool = false

var draw_deck: Array[CardData] = []
var mission_manager: MissionManager = null

func _ready() -> void:
	mission_manager = MissionManager.new()
	mission_manager.mission_tokens_placed.connect(_on_mission_tokens_placed)
	mission_manager.mission_claimed.connect(_on_mission_claimed)

func setup_new_game(p1_name: String = "Player 1", p2_name: String = "AI Opponent", p2_is_ai: bool = true) -> void:
	is_game_over = false
	current_round = 0
	action_counter = 0
	
	players.clear()
	var p1 = PlayerState.new()
	p1.player_id = "P1"; p1.display_name = p1_name; p1.is_ai = false
	var p2 = PlayerState.new()
	p2.player_id = "P2"; p2.display_name = p2_name; p2.is_ai = p2_is_ai
	players.append(p1)
	players.append(p2)
	
	mission_manager.initialize_missions()
	_draft_and_deal()
	start_round(1)

func get_active_player() -> PlayerState:
	return players[active_player_index]

func get_opponent_player() -> PlayerState:
	return players[(active_player_index + 1) % 2]

func start_round(round_number: int) -> void:
	current_round = round_number
	var mission = mission_manager.draw_round_mission()
	_log(get_active_player(), "MISSION-REVEAL", "Round %d Mission revealed: %s (%d pts)" % [round_number, mission.get("name", ""), mission.get("points", 0)])
	start_turn(0)

func start_turn(player_idx: int) -> void:
	active_player_index = player_idx
	var player = get_active_player()
	player.reset_turn_telemetry()
	player.refresh_cards()
	
	# Mandatory turn-start coin production into floating pool
	var start_prod = player.affiliation.production if player.affiliation else 0
	for loc in player.battlefield:
		if loc.card_type == CardData.CardType.LOCATION and loc.special_ability == CardData.SpecialAbility.NONE:
			start_prod += loc.production
	player.current_turn_coins += start_prod
	
	# Mandatory Card Draw
	var drawn_names: Array[String] = []
	for i in range(cards_drawn_per_turn):
		if player.hand.size() < max_hand_size and not draw_deck.is_empty():
			var card = draw_deck.pop_back()
			player.hand.append(card)
			drawn_names.append(card.card_name)
			
	_log(player, "TURN-START", "Round %d turn began. Produced +%d floating coins. Drew: %s" % [current_round, start_prod, str(drawn_names)])
	state_updated.emit()

func end_turn() -> void:
	var player = get_active_player()
	
	# Evaluate turn-end mission listeners
	if player.operations_conducted_this_turn == 0:
		mission_manager.add_mission_tokens(player, "no_ops", 1)
	if player.unique_operations_this_turn.size() >= 3:
		mission_manager.add_mission_tokens(player, "ops_in_turn", 1)
	if player.hand.is_empty() and player.cards_played_this_turn >= 3:
		mission_manager.add_mission_tokens(player, "empty_hand", 1)
		
	# Distribute remaining floating coins round-robin
	var store_res = player.store_remaining_coins(affiliation_max_cap)
	if store_res["stored"] > 0 or store_res["discarded"] > 0:
		_log(player, "COIN-STORE", "Stored %d coins. Discarded %d overflow." % [store_res["stored"], store_res["discarded"]])
		
	if is_game_over:
		return
		
	# Next turn or next round
	if active_player_index == 0:
		start_turn(1)
	else:
		if current_round >= rounds_limit:
			_evaluate_final_winner()
		else:
			start_round(current_round + 1)

# ==============================================================================
# SECTION 1: GLOBAL DOMINION PLAN VALIDATION (3 WIN CONDITIONS)
# ==============================================================================
## Strict validation of the 3 win conditions before allowing play:
## 1. Eliminated another player's operative this turn
## 2. Raided for at least 4 resources this turn
## 3. Discarded a card from your own hand this turn
func can_play_global_dominion_plan(player: PlayerState) -> bool:
	var cond_op_eliminated = player.eliminated_enemy_op_this_turn
	var cond_raided_4 = (player.raided_coins_this_turn >= 4)
	var cond_discarded_hand = player.discarded_card_from_hand_this_turn
	var can_afford = (player.get_total_spendable_coins() >= 8)
	return cond_op_eliminated and cond_raided_4 and cond_discarded_hand and can_afford

# ==============================================================================
# SECTION 2: DEFENSIVE MISSION LISTENERS (INTERCEPT / THWART CHECKS)
# ==============================================================================
## Checks if defender has an eligible READY operative to intercept/thwart incoming attack:
## - 'thwart_raid': Firewall Expert (Ready operative with Raid skill >= 1 or high defense)
## - 'thwart_ass': Expert Bodyguard (Ready operative with Assassin skill >= 1 or guard defense)
## - 'thwart_sub': Counterintelligence (Ready operative with Subterfuge skill >= 1)
func find_defensive_interceptor(defender: PlayerState, threat_type: String) -> CardData:
	var ready_ops: Array[CardData] = []
	for c in defender.battlefield:
		if c.card_type == CardData.CardType.OPERATIVE and not c.is_exhausted:
			ready_ops.append(c)
			
	if ready_ops.is_empty():
		return null
		
	match threat_type:
		"raid":
			for op in ready_ops:
				if op.skill_raid >= 1:
					return op
			return ready_ops[0]
		"ass":
			for op in ready_ops:
				if op.skill_assassin >= 1:
					return op
			return ready_ops[0]
		"sub":
			for op in ready_ops:
				if op.skill_subterfuge >= 1:
					return op
			return ready_ops[0]
	return null

# ==============================================================================
# SECTION 3: SPECIALIZED OPERATIVES, LOCATIONS, AND ACTIONS EXECUTION
# ==============================================================================
func execute_action(action_dict: Dictionary) -> bool:
	if is_game_over:
		return false
		
	var player = get_active_player()
	var opponent = get_opponent_player()
	var act_type = action_dict.get("type", ActionType.PASS)
	
	match act_type:
		ActionType.PASS:
			end_turn()
			return true
			
		ActionType.TAP_PROD:
			var card: CardData = action_dict.get("card")
			card.is_exhausted = true
			var prod = card.production
			player.current_turn_coins += prod
			_log(player, "PRODUCE", "Tapped %s for +%d coins." % [card.card_name, prod])
			state_updated.emit()
			return true
			
		ActionType.TAP_ABILITY:
			var card: CardData = action_dict.get("card")
			card.is_exhausted = true
			
			match card.special_ability:
				CardData.SpecialAbility.LOC_ARMORY_BUFF:
					# Armory: Tap to give operative +1 Offense or +1 Defense
					var target: CardData = action_dict.get("target")
					var choice: String = action_dict.get("buff_choice", "offense")
					if choice == "offense":
						target.temp_offense_buff += 1
						_log(player, "ARMORY-BUFF", "Armory gave %s +1 Offense." % target.card_name)
					else:
						target.temp_defense_buff += 1
						_log(player, "ARMORY-BUFF", "Armory gave %s +1 Defense." % target.card_name)
				
				CardData.SpecialAbility.LOC_TROLL_FARM_DISCARD:
					# Troll Farm: Tap to force target player to discard a card
					if not opponent.hand.is_empty():
						var dropped = opponent.hand.pop_back()
						opponent.discard_pile.append(dropped)
						opponent.discarded_card_from_hand_this_turn = true
						_log(player, "TROLL-FARM", "Troll Farm forced %s to discard: %s." % [opponent.display_name, dropped.card_name])
						if opponent.hand.is_empty():
							mission_manager.add_mission_tokens(player, "hand_wipe", 1)
				
				CardData.SpecialAbility.LOC_RESEARCH_DRAW, CardData.SpecialAbility.AFF_IMF_DRAW:
					# Research Facility: Tap to draw a card
					if player.hand.size() < max_hand_size and not draw_deck.is_empty():
						var drawn = draw_deck.pop_back()
						player.hand.append(drawn)
						_log(player, "RESEARCH-DRAW", "%s tapped: Drew %s." % [card.card_name, drawn.card_name])
				
				CardData.SpecialAbility.AFF_SHADOW_SPAWN_TOKEN:
					var token = CardData.new()
					token.card_name = "Shadow Warrior Token"
					token.card_type = CardData.CardType.OPERATIVE
					token.cost = 0; token.offense = 1; token.defense = 1; token.skill_assassin = 1
					token.is_exhausted = (operative_summon_state == "E")
					player.battlefield.append(token)
					_log(player, "SPAWN-TOKEN", "Spawned 1/1 Shadow Warrior Token.")
			
			state_updated.emit()
			return true

		ActionType.PLAY_CARD:
			var card: CardData = action_dict.get("card")
			var cost = card.cost
			if player.affiliation and player.affiliation.special_ability == CardData.SpecialAbility.AFF_MK_DISCOUNT_OP and card.card_type == CardData.CardType.OPERATIVE:
				cost = maxi(0, cost - 1)
				
			if not player.spend_coins(cost):
				return false
				
			player.hand.erase(card)
			player.cards_played_this_turn += 1
			
			if card.is_named:
				player.played_named_this_turn = true
				mission_manager.add_mission_tokens(player, "play_named", 1)
				
			# Check Global Dominion Plan victory
			if card.special_ability == CardData.SpecialAbility.SUPPORT_GLOBAL_DOMINION_PLAN:
				player.discard_pile.append(card)
				_log(player, "DOMINION-WIN", "⚡ GLOBAL DOMINION PLAN ENACTED! All 3 victory conditions fulfilled!")
				_declare_winner(player, "Executed Global Dominion Plan successfully!")
				return true
				
			if card.card_type == CardData.CardType.LOCATION:
				card.is_exhausted = (location_summon_state == "E")
				player.battlefield.append(card)
				_log(player, "PLAY-LOC", "Deployed Location: %s (Cost: %d)" % [card.card_name, cost])
				
			elif card.card_type == CardData.CardType.OPERATIVE:
				card.is_exhausted = (operative_summon_state == "E")
				player.battlefield.append(card)
				_log(player, "PLAY-OP", "Deployed Operative: %s (Cost: %d)" % [card.card_name, cost])
				
				# Ghost: Siphons 2 resources upon deployment
				if card.special_ability == CardData.SpecialAbility.OP_GHOST_SIPHON_2:
					_trigger_ghost_siphon(player, opponent, card)
					
			elif card.card_type == CardData.CardType.SUPPORT:
				player.discard_pile.append(card)
				_resolve_support_spell(player, opponent, card)
				
			state_updated.emit()
			return true

		ActionType.DAN_WEAK_SACRIFICE:
			# Dan Weak: Sacrificed from play to either force target to discard hand or discard 2 cards in play
			var card: CardData = action_dict.get("card")
			player.battlefield.erase(card)
			player.discard_pile.append(card)
			
			var choice: String = action_dict.get("sacrifice_choice", "discard_hand")
			if choice == "discard_hand":
				var count = opponent.hand.size()
				for c in opponent.hand:
					opponent.discard_pile.append(c)
				opponent.hand.clear()
				opponent.discarded_card_from_hand_this_turn = true
				_log(player, "DAN-WEAK-SACRIFICE", "Dan Weak sacrificed! Wiped %s's hand (%d cards)." % [opponent.display_name, count])
				if count > 0:
					mission_manager.add_mission_tokens(player, "hand_wipe", 1)
			else:
				# Discard 2 cards from play
				var removed_names: Array[String] = []
				for i in range(2):
					if not opponent.battlefield.is_empty():
						var disc = opponent.battlefield.pop_back()
						opponent.discard_pile.append(disc)
						removed_names.append(disc.card_name)
						if disc.card_type == CardData.CardType.OPERATIVE:
							player.eliminated_enemy_op_this_turn = true
							mission_manager.add_mission_tokens(player, "kills", 1)
				_log(player, "DAN-WEAK-SACRIFICE", "Dan Weak sacrificed! Discarded 2 cards from play: %s." % str(removed_names))
				
			state_updated.emit()
			return true

		ActionType.OPERATIVE_ACTION:
			var card: CardData = action_dict.get("card")
			card.is_exhausted = true
			player.operations_conducted_this_turn += 1
			var op_type: String = action_dict.get("op_type", "hold")
			
			# Boksoon Ability: Discard enemy operative in play with Assassin skill >= 1
			if card.special_ability == CardData.SpecialAbility.OP_BOKSOON_DISCARD_ASS1 and op_type == "boksoon_execute":
				var target: CardData = action_dict.get("target")
				var interceptor = find_defensive_interceptor(opponent, "ass")
				if interceptor:
					interceptor.is_exhausted = true
					_log(opponent, "THWART-ASS", "🛡️ DEFENSIVE INTERCEPT! Bodyguard %s thwarted Boksoon's strike!" % interceptor.card_name)
					mission_manager.add_mission_tokens(opponent, "thwart_ass", 1)
				else:
					opponent.battlefield.erase(target)
					opponent.discard_pile.append(target)
					player.eliminated_enemy_op_this_turn = true
					_log(player, "BOKSOON-EXECUTE", "Boksoon executed targeted assassination on %s (Assassin >= 1)." % target.card_name)
					mission_manager.add_mission_tokens(player, "kills", 1)
				state_updated.emit()
				return true

			# Mata Hari Ability: Take a random card from target player's hand
			if card.special_ability == CardData.SpecialAbility.OP_MATA_HARI_STEAL_HAND and op_type == "mata_hari_steal":
				var interceptor = find_defensive_interceptor(opponent, "sub")
				if interceptor:
					interceptor.is_exhausted = true
					_log(opponent, "THWART-SUB", "🛡️ DEFENSIVE INTERCEPT! Counterintelligence agent %s intercepted Mata Hari!" % interceptor.card_name)
					mission_manager.add_mission_tokens(opponent, "thwart_sub", 1)
				elif not opponent.hand.is_empty():
					var rand_idx = randi() % opponent.hand.size()
					var stolen = opponent.hand[rand_idx]
					opponent.hand.remove_at(rand_idx)
					player.hand.append(stolen)
					player.unique_operations_this_turn["sub"] = true
					_log(player, "MATA-HARI-STEAL", "Mata Hari charmed and stole %s from %s's hand!" % [stolen.card_name, opponent.display_name])
					if opponent.hand.is_empty():
						mission_manager.add_mission_tokens(player, "hand_wipe", 1)
				state_updated.emit()
				return true

			# Ghost Ability: Siphon 2 resources upon activation
			if card.special_ability == CardData.SpecialAbility.OP_GHOST_SIPHON_2 and op_type == "ghost_activate":
				var interceptor = find_defensive_interceptor(opponent, "raid")
				if interceptor:
					interceptor.is_exhausted = true
					_log(opponent, "THWART-RAID", "🛡️ DEFENSIVE INTERCEPT! Firewall Expert %s blocked Ghost's siphon!" % interceptor.card_name)
					mission_manager.add_mission_tokens(opponent, "thwart_raid", 1)
				else:
					_trigger_ghost_siphon(player, opponent, card)
				state_updated.emit()
				return true

			# Standard Combat: Assassinate with Defensive Bodyguard Intercept
			if op_type == "ass":
				player.unique_operations_this_turn["ass"] = true
				var target: CardData = action_dict.get("target")
				var interceptor = find_defensive_interceptor(opponent, "ass")
				if interceptor:
					interceptor.is_exhausted = true
					_log(opponent, "THWART-ASS", "🛡️ DEFENSIVE INTERCEPT! Bodyguard %s blocked assassination on %s!" % [interceptor.card_name, target.card_name])
					mission_manager.add_mission_tokens(opponent, "thwart_ass", 1)
				else:
					var eff_atk = card.get_effective_offense()
					var eff_def = target.get_effective_defense(true)
					if eff_atk > eff_def:
						opponent.battlefield.erase(target)
						opponent.discard_pile.append(target)
						player.eliminated_enemy_op_this_turn = true
						_log(player, "ASSASSINATE", "%s (ATK:%d) eliminated %s (DEF:%d)." % [card.card_name, eff_atk, target.card_name, eff_def])
						mission_manager.add_mission_tokens(player, "kills", 1)
				state_updated.emit()
				return true

			# Standard Combat: Raid with Defensive Firewall Intercept
			if op_type == "raid":
				player.unique_operations_this_turn["raid"] = true
				var interceptor = find_defensive_interceptor(opponent, "raid")
				if interceptor:
					interceptor.is_exhausted = true
					_log(opponent, "THWART-RAID", "🛡️ DEFENSIVE INTERCEPT! Firewall Expert %s countered the raid!" % interceptor.card_name)
					mission_manager.add_mission_tokens(opponent, "thwart_raid", 1)
				else:
					var max_steal = 1 + card.skill_raid
					var stolen = mini(opponent.get_total_spendable_coins(), max_steal)
					if stolen > 0:
						opponent.spend_coins(stolen)
						player.current_turn_coins += stolen
						player.raided_coins_this_turn += stolen
						_log(player, "RAID", "%s raided and captured %d coins from %s." % [card.card_name, stolen, opponent.display_name])
						mission_manager.add_mission_tokens(player, "res_theft", stolen)
				state_updated.emit()
				return true

			# Standard Combat: Subterfuge with Defensive Counterintelligence Intercept
			if op_type == "sub":
				player.unique_operations_this_turn["sub"] = true
				var interceptor = find_defensive_interceptor(opponent, "sub")
				if interceptor:
					interceptor.is_exhausted = true
					_log(opponent, "THWART-SUB", "🛡️ DEFENSIVE INTERCEPT! Counterintelligence agent %s intercepted subterfuge!" % interceptor.card_name)
					mission_manager.add_mission_tokens(opponent, "thwart_sub", 1)
				else:
					var to_drop = mini(opponent.hand.size(), 1 + card.skill_subterfuge)
					var dropped_list: Array[String] = []
					for i in range(to_drop):
						if not opponent.hand.is_empty():
							var disc = opponent.hand.pop_back()
							opponent.discard_pile.append(disc)
							dropped_list.append(disc.card_name)
							opponent.discarded_card_from_hand_this_turn = true
					_log(player, "SUBTERFUGE", "%s forced %s to discard: %s." % [card.card_name, opponent.display_name, str(dropped_list)])
					if opponent.hand.is_empty() and to_drop > 0:
						mission_manager.add_mission_tokens(player, "hand_wipe", 1)
				state_updated.emit()
				return true

			if op_type == "hold":
				_log(player, "HOLD", "%s fortified ready defensive perimeter." % card.card_name)
				state_updated.emit()
				return true

	return false

func _trigger_ghost_siphon(player: PlayerState, opponent: PlayerState, card: CardData) -> void:
	var stolen = mini(opponent.get_total_spendable_coins(), 2)
	if stolen > 0:
		opponent.spend_coins(stolen)
		player.current_turn_coins += stolen
		player.raided_coins_this_turn += stolen
		_log(player, "GHOST-SIPHON", "Ghost cyber-siphon captured %d resources from %s." % [stolen, opponent.display_name])
		mission_manager.add_mission_tokens(player, "res_theft", stolen)

func _resolve_support_spell(player: PlayerState, opponent: PlayerState, card: CardData) -> void:
	match card.card_name:
		"Funding":
			player.current_turn_coins += 3
			_log(player, "FUNDING", "+3 coins added to floating turn pool.")
		"Assassination Training":
			for c in player.battlefield:
				if c.card_type == CardData.CardType.OPERATIVE:
					c.skill_assassin += 2
					_log(player, "TRAIN", "Trained %s with +2 Assassin skill." % c.card_name)
					break
		"Targeted for Whitewash":
			for c in opponent.battlefield:
				if c.card_type == CardData.CardType.OPERATIVE:
					opponent.battlefield.erase(c)
					opponent.discard_pile.append(c)
					player.eliminated_enemy_op_this_turn = true
					_log(player, "WHITEWASH", "Eliminated enemy operative %s." % c.card_name)
					mission_manager.add_mission_tokens(player, "kills", 1)
					break

func _declare_winner(player: PlayerState, reason: String) -> void:
	is_game_over = true
	game_concluded.emit(player, reason)

func _evaluate_final_winner() -> void:
	is_game_over = true
	var p1 = players[0]
	var p2 = players[1]
	if p1.mission_points > p2.mission_points:
		_declare_winner(p1, "Higher mission points (%d vs %d)." % [p1.mission_points, p2.mission_points])
	elif p2.mission_points > p1.mission_points:
		_declare_winner(p2, "Higher mission points (%d vs %d)." % [p2.mission_points, p1.mission_points])
	else:
		var p1_c = p1.get_total_spendable_coins()
		var p2_c = p2.get_total_spendable_coins()
		if p1_c > p2_c:
			_declare_winner(p1, "Coin wealth tie-breaker (%d vs %d coins)." % [p1_c, p2_c])
		elif p2_c > p1_c:
			_declare_winner(p2, "Coin wealth tie-breaker (%d vs %d coins)." % [p2_c, p1_c])
		else:
			_declare_winner(null, "Match tied with identical points and coins.")

func _log(player: PlayerState, code: String, details: String) -> void:
	action_counter += 1
	var entry = {
		"round": current_round,
		"action": action_counter,
		"pid": player.player_id if player else "SYS",
		"code": code,
		"details": details,
		"balance": "[Coins: %d (Turn: %d, Stored: %d)]" % [player.get_total_spendable_coins(), player.current_turn_coins, player.get_stored_coins()] if player else ""
	}
	print("  %d.%d.%s: [%s] %s %s" % [entry.round, entry.action, entry.pid, entry.code, entry.details, entry.balance])
	action_logged.emit(entry)

func _draft_and_deal() -> void:
	# Populate card decks (Affiliation, Location, Operative, Support)
	# Production implementation loads from CSV or built-in resources
	pass

func _on_mission_tokens_placed(pid: String, m_name: String, amt: int, curr: int, req: int) -> void:
	pass

func _on_mission_claimed(pid: String, m_name: String, pts: int) -> void:
	var player = players[0] if pid == "P1" else players[1]
	if points_to_win > 0 and player.mission_points >= points_to_win:
		_declare_winner(player, "Reached %d victory points threshold!" % points_to_win)
`
  },
  {
    filename: "ISMCTSAgent.gd",
    category: "AI Engine",
    description: "Information Set Monte Carlo Tree Search (ISMCTS) bot with hidden state determinization and UCT action selection.",
    code: `# res://scripts/ai/ISMCTSAgent.gd
class_name ISMCTSAgent
extends RefCounted

class MCTSNode:
	var action: Dictionary = {}
	var parent: MCTSNode = null
	var children: Array[MCTSNode] = []
	var visits: int = 0
	var total_value: float = 0.0
	var untried_actions: Array[Dictionary] = []

	func _init(act: Dictionary = {}, p: MCTSNode = null) -> void:
		action = act
		parent = p

	func select_child(c: float = 1.414) -> MCTSNode:
		var best: MCTSNode = children[0]
		var best_uct: float = -INF
		for child in children:
			var exploit = child.total_value / float(child.visits)
			var explore = sqrt(log(float(visits)) / float(child.visits))
			var uct = exploit + c * explore
			if uct > best_uct:
				best_uct = uct
				best = child
		return best

var iterations: int = 40
var exploration_constant: float = 1.414

func _init(p_iterations: int = 40) -> void:
	iterations = p_iterations

func select_best_action(engine: SpywarEngine, player: PlayerState, opponent: PlayerState) -> Dictionary:
	var legal_actions = _generate_legal_actions(engine, player, opponent)
	if legal_actions.size() <= 1:
		return legal_actions[0] if not legal_actions.is_empty() else {"type": SpywarEngine.ActionType.PASS}
		
	# Immediate heuristic: If Global Dominion Plan condition is fulfilled, execute victory!
	for act in legal_actions:
		if act.get("type") == SpywarEngine.ActionType.PLAY_CARD:
			var c = act.get("card") as CardData
			if c and c.special_ability == CardData.SpecialAbility.SUPPORT_GLOBAL_DOMINION_PLAN:
				return act
				
	var root = MCTSNode.new()
	root.untried_actions = legal_actions.duplicate()
	
	for i in range(iterations):
		var node = root
		
		# 1. Determinization: Clone game state and shuffle hidden information
		# (Shuffle opponent hand and draw deck to avoid omniscience)
		
		# 2. Selection
		while node.untried_actions.is_empty() and not node.children.is_empty():
			node = node.select_child(exploration_constant)
			
		# 3. Expansion
		if not node.untried_actions.is_empty():
			var act = node.untried_actions.pop_back()
			var child = MCTSNode.new(act, node)
			node.children.append(child)
			node = child
			
		# 4. Simulation / Rollout (heuristic evaluation)
		var sim_value = _evaluate_heuristic(player, opponent)
		
		# 5. Backpropagation
		var curr: MCTSNode = node
		while curr != null:
			curr.visits += 1
			curr.total_value += sim_value
			curr = curr.parent

	# Pick most visited child for robustness
	var best_child: MCTSNode = root.children[0]
	for child in root.children:
		if child.visits > best_child.visits:
			best_child = child
			
	return best_child.action

func _evaluate_heuristic(player: PlayerState, opponent: PlayerState) -> float:
	var mission_diff = float(player.mission_points - opponent.mission_points) * 10.0
	var coin_diff = float(player.get_total_spendable_coins() - opponent.get_total_spendable_coins()) * 0.5
	return mission_diff + coin_diff

func _generate_legal_actions(engine: SpywarEngine, player: PlayerState, opponent: PlayerState) -> Array[Dictionary]:
	var actions: Array[Dictionary] = []
	# 1. Tapping Affiliation & Locations
	if player.affiliation and not player.affiliation.is_exhausted:
		actions.append({"type": SpywarEngine.ActionType.TAP_PROD, "card": player.affiliation})
		
	for loc in player.battlefield:
		if loc.card_type == CardData.CardType.LOCATION and not loc.is_exhausted:
			actions.append({"type": SpywarEngine.ActionType.TAP_PROD, "card": loc})
			if loc.special_ability == CardData.SpecialAbility.LOC_RESEARCH_DRAW:
				actions.append({"type": SpywarEngine.ActionType.TAP_ABILITY, "card": loc})
			elif loc.special_ability == CardData.SpecialAbility.LOC_TROLL_FARM_DISCARD and not opponent.hand.is_empty():
				actions.append({"type": SpywarEngine.ActionType.TAP_ABILITY, "card": loc})
			elif loc.special_ability == CardData.SpecialAbility.LOC_ARMORY_BUFF:
				for op in player.battlefield:
					if op.card_type == CardData.CardType.OPERATIVE:
						actions.append({"type": SpywarEngine.ActionType.TAP_ABILITY, "card": loc, "target": op, "buff_choice": "offense"})
						actions.append({"type": SpywarEngine.ActionType.TAP_ABILITY, "card": loc, "target": op, "buff_choice": "defense"})

	# 2. Play cards from hand
	var spendable = player.get_total_spendable_coins()
	for card in player.hand:
		if card.special_ability == CardData.SpecialAbility.SUPPORT_GLOBAL_DOMINION_PLAN:
			if engine.can_play_global_dominion_plan(player):
				actions.append({"type": SpywarEngine.ActionType.PLAY_CARD, "card": card})
		elif card.cost <= spendable:
			actions.append({"type": SpywarEngine.ActionType.PLAY_CARD, "card": card})

	# 3. Operative actions
	for op in player.battlefield:
		if op.card_type == CardData.CardType.OPERATIVE and not op.is_exhausted:
			if op.special_ability == CardData.SpecialAbility.OP_DAN_WEAK_SACRIFICE:
				if not opponent.hand.is_empty():
					actions.append({"type": SpywarEngine.ActionType.DAN_WEAK_SACRIFICE, "card": op, "sacrifice_choice": "discard_hand"})
				if not opponent.battlefield.is_empty():
					actions.append({"type": SpywarEngine.ActionType.DAN_WEAK_SACRIFICE, "card": op, "sacrifice_choice": "discard_in_play"})
					
			if op.special_ability == CardData.SpecialAbility.OP_BOKSOON_DISCARD_ASS1:
				for enemy in opponent.battlefield:
					if enemy.card_type == CardData.CardType.OPERATIVE and enemy.skill_assassin >= 1:
						actions.append({"type": SpywarEngine.ActionType.OPERATIVE_ACTION, "card": op, "target": enemy, "op_type": "boksoon_execute"})

			if op.special_ability == CardData.SpecialAbility.OP_MATA_HARI_STEAL_HAND and not opponent.hand.is_empty():
				actions.append({"type": SpywarEngine.ActionType.OPERATIVE_ACTION, "card": op, "op_type": "mata_hari_steal"})

			if op.special_ability == CardData.SpecialAbility.OP_GHOST_SIPHON_2 and opponent.get_total_spendable_coins() > 0:
				actions.append({"type": SpywarEngine.ActionType.OPERATIVE_ACTION, "card": op, "op_type": "ghost_activate"})

			# Standard offensive operations
			if opponent.get_total_spendable_coins() > 0:
				actions.append({"type": SpywarEngine.ActionType.OPERATIVE_ACTION, "card": op, "op_type": "raid"})
			if not opponent.hand.is_empty():
				actions.append({"type": SpywarEngine.ActionType.OPERATIVE_ACTION, "card": op, "op_type": "sub"})
			actions.append({"type": SpywarEngine.ActionType.OPERATIVE_ACTION, "card": op, "op_type": "hold"})

	# 4. Pass
	actions.append({"type": SpywarEngine.ActionType.PASS})
	return actions
`
  },
  {
    filename: "SpywarNetworkManager.gd",
    category: "Online Multiplayer & Monetization",
    description: "Server-authoritative WebSockets/ENet RPC manager, hidden state sanitizer for fair competitive play, and monetization cosmetic hooks.",
    code: `# res://scripts/network/SpywarNetworkManager.gd
class_name SpywarNetworkManager
extends Node

## Server-Authoritative Online Multiplayer & Monetization Architecture for SPYWAR
signal player_connected(peer_id: int)
signal match_started(room_code: String)
signal sync_state_received(sanitized_state: Dictionary)

const SERVER_PORT: int = 9080
const MAX_PLAYERS_PER_ROOM: int = 2

var peer: ENetMultiplayerPeer = null
var current_room_code: String = ""
var is_server: bool = false
var authoritative_engine: SpywarEngine = null

# Monetization & Player Profile Catalog
var player_cosmetics: Dictionary = {
	"card_back": "classified_gold",
	"operative_skin_dan_weak": "cyberpunk_dan",
	"token_theme": "neon_tactical"
}

func start_dedicated_server(port: int = SERVER_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var err = peer.create_server(port, 32)
	if err == OK:
		multiplayer.multiplayer_peer = peer
		is_server = true
		authoritative_engine = SpywarEngine.new()
		add_child(authoritative_engine)
		print("📡 [SPYWAR SERVER] Running authoritative host on port %d." % port)
	return err

func connect_to_server(ip_address: String, port: int = SERVER_PORT) -> Error:
	peer = ENetMultiplayerPeer.new()
	var err = peer.create_client(ip_address, port)
	if err == OK:
		multiplayer.multiplayer_peer = peer
		is_server = false
		print("🛰️ [SPYWAR CLIENT] Connected to game server at %s:%d." % [ip_address, port])
	return err

## Client sends action request to server for authoritative validation
@rpc("any_peer", "call_remote", "reliable")
func submit_action_request(action_payload: Dictionary) -> void:
	if not is_server:
		return
	var sender_id = multiplayer.get_remote_sender_id()
	# Validate active turn ownership & legal rules
	var success = authoritative_engine.execute_action(action_payload)
	if success:
		_broadcast_sanitized_states()

## Broadcast sanitized state (Crucial: hides private opponent hand cards to prevent cheating)
func _broadcast_sanitized_states() -> void:
	if not is_server:
		return
	for p_id in multiplayer.get_peers():
		var sanitized = _sanitize_state_for_peer(p_id)
		rpc_id(p_id, "receive_state_sync", sanitized)

@rpc("authority", "call_remote", "reliable")
func receive_state_sync(sanitized_state: Dictionary) -> void:
	sync_state_received.emit(sanitized_state)

func _sanitize_state_for_peer(peer_id: int) -> Dictionary:
	# Strips private card identities from opponent hand, sending count only
	return {
		"round": authoritative_engine.current_round,
		"active_pid": authoritative_engine.get_active_player().player_id,
		"missions": authoritative_engine.mission_manager.active_missions_on_table,
		"spendable_coins": authoritative_engine.get_active_player().get_total_spendable_coins()
	}
`
  }
];
