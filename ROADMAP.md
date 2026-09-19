# SPYWAR Project Roadmap & Milestone Tracker

A live development roadmap tracking completed systems, current production releases, and upcoming milestones for the **SPYWAR** espionage card game engine, web simulator, and Godot 4 suite.

---

## 🏆 Current Release: `v1.3.0` (Live on Vercel & AI Studio)
- **Production URL**: [spywar.vercel.app](https://spywar.vercel.app)
- **Platform Sync**: Google AI Studio &bull; GitHub (`yugohachiken/spywar`) &bull; Vercel CI/CD

---

## ✅ Accomplished Milestones

### Phase 1: Core Engine & Rules Architecture
- [x] **Strict Phase-Based Turn Lifecycle**: Implemented `DRAW` (refresh exhausted cards, hand refill to 5), `OPERATIONS` (resource generation, card deployments, combat actions), and `CLEANUP` (coin storage caps, excess resource banking, and discard).
- [x] **Complete Espionage Combat Engine**:
  - **Assassination**: Operative elimination and target defenses.
  - **Raid Operations**: Coin siphoning and location sabotage based on Raid ranks.
  - **Subterfuge**: Disruptive hand discards, intel reveals, and tactical denial.
  - **Defense Systems**: Bodyguards, Firewalls, and Counterintelligence shields.
- [x] **Victory Conditions**: Dual-path winning criteria via Master Mission scoring or executing the 5-part Global Dominion Plan.
- [x] **Card Manifest**: 4 balanced Affiliations, 8 Location bases, 12 Operatives, and 12 Support tactic cards.

### Phase 2: AI & Balance Simulation
- [x] **ISMCTS AI Agent**: Information Set Monte Carlo Tree Search capable of tactical decision-making under imperfect information (hidden cards in opponent hand/deck).
- [x] **Interactive Ability Test Lab**: 21 pre-configured test scenarios with discrete state assertions for abilities, triggers, and edge cases.
- [x] **Headless Batch Balancer**: Multi-threaded automated batch runner with statistical win-rate analytics, turn duration metrics, and agency balance charts.

### Phase 3: Godot 4 Engine Architecture
- [x] **GDScript 2.0 Engine Implementation**: Complete standalone Godot 4 state machine mirroring the TypeScript game engine.
- [x] **In-App Code Viewer**: Godot GDScript export panel with syntax highlighting, single-file copy, and download utilities.

### Phase 4: Cloud Multiplayer & Cross-Platform Play (`v1.2.0`)
- [x] **Firestore Real-Time Sync**: Serverless real-time document synchronization for match lobbies, turns, card moves, and battle logs.
- [x] **Frictionless Zero-Login Access**: Eliminated mandatory third-party OAuth barriers; players join immediately with custom call-signs and anonymous player IDs.
- [x] **Room & Invite Code System**: 6-character room codes with one-click clipboard link sharing and instant lobby joining.
- [x] **Cross-Device Verified**: Tested and verified live between Desktop/Laptop and Mobile browsers.
- [x] **Visual Version Stamping**: Integrated `v1.2.0` build stamps in the app footer and multiplayer modal to guarantee client build parity.

### Phase 5: CI/CD & Production Infrastructure
- [x] **Continuous Deployment**: Automated GitHub webhook triggering Vercel production builds on commit to `main`.
- [x] **Clean Repository Pipeline**: Unified repository structure on `yugohachiken/spywar`.

### Phase 6: Accessibility & Visual Impairment Magnifier (`v1.3.0`)
- [x] **Tabletopia-Style Spacebar Card Zoom**: Pressing Spacebar magnifies the hovered, focused, or selected card 3x or 5x larger. Another press of Spacebar or Esc closes the magnified view.
- [x] **Dual Magnification Scales (3x and 5x)**: Toggle between 3x (~500px) and 5x (~760px) large-print formats.
- [x] **High-Contrast Large-Print Typography & Stats**: WCAG-compliant high-contrast cards with 32px combat stats, detailed skill descriptions, and large-print ability rules.
- [x] **Web Speech Audio Read-Aloud (TTS)**: Integrated Text-to-Speech screen reader allowing visually impaired players to hear card stats and abilities read aloud.
- [x] **Multi-Input Accessibility**: Works seamlessly with keyboard navigation (`Tab` + `Space`), mouse hover/click, and touchscreen tap. Also supports table mission cards.

---

## 🎯 Next Objectives (Prioritized Roadmap)

### 📌 Milestone 6: Lobby Quality of Life & Session Resilience (Immediate Next)
- [ ] **Turn Countdown Timer**:
  - Configurable turn timer (e.g. 60s / 90s) with visual pulse animation.
  - Auto-pass turn on expiration to prevent abandoned matches.
- [ ] **Player Presence & Heartbeat**:
  - Active ping indicator (Online / Away / Disconnected) for opponent status.
  - Visual badge in the lobby and match header indicating connection health.
- [ ] **Seamless Match Reconnect**:
  - Allow players who refresh their browser tab or switch mobile apps to instantly reconnect into their active match room without losing state.
- [ ] **In-Game Emotes / Tactical Comms**:
  - Quick espionage-themed tactical pings ("Target Acquired", "Nice Move", "Cover Blown", "Good Game").

---

### 📌 Milestone 7: Audio & Visual Polish ("Juice")
- [ ] **Espionage Sound Effects (Web Audio API)**:
  - Tactical card deployment audio, coin clinks on banking, operation sound effects (silenced shot, hack terminal keystrokes, radar sweep), and mission completion fanfares.
  - Mute/Unmute toggle saved to local storage.
- [ ] **Combat & Action Targeting Visualizer**:
  - Visual targeting reticle/arrow linking acting card to the target enemy card during Assassination, Raid, or Subterfuge.
- [ ] **Dynamic Turn Banners**:
  - Cinematic "YOUR TURN" / "ENEMY OPERATIONS" overlay banners transitioning between turns.

---

### 📌 Milestone 8: Deck Customization & Pre-Match Draft
- [ ] **Agency Deck Builder**:
  - Filterable card catalog allowing players to construct a custom 30-card agency deck.
  - Deck validation (minimum requirements, unique cards, maximum copies).
- [ ] **Pre-Match Draft Mode**:
  - Alternative game mode where players take turns drafting operatives and tactics before the match begins.

---

### 📌 Milestone 9: Match Replays & Statistics
- [ ] **Full Match PGN / JSON Replay**:
  - Save full match history with forward/backward turn scrubbers for post-match analysis.
- [ ] **Career Dossier / Player Stats**:
  - Track player win/loss records, preferred Affiliations, mission fulfillment rates, and highest combat rounds.

---

### 📌 Milestone 10: Godot 4 Native Export
- [ ] **Godot 4 Project Template**:
  - Package `.tscn` scenes and Godot assets for export to native Windows, macOS, Linux, and Android APK builds using the validated GDScript engine.

---

*Last Updated: September 19, 2026 &bull; Build `v1.2.0`*
