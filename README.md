# SPYWAR

A tactical espionage card game and simulation engine built with React, TypeScript, Vite, and Tailwind CSS. Features full rules enforcement, an Information Set Monte Carlo Tree Search (ISMCTS) AI opponent, multi-operative team actions, interactive Ability Testing Labs, and a Godot 4 GDScript reference implementation.

## Overview

SPYWAR simulates high-stakes intelligence warfare between rival agencies. Players manage their Affiliation headquarters, deploy Operatives, infiltrate and construct Locations, play Support tactics, raid resources, conduct assassinations, execute subterfuge against opponent hands, and compete to fulfill Master Missions or complete the **Global Dominion Plan**.

### Core Game Systems
- **Phase-Based Turn Lifecycle**: Strict turn structure with `DRAW` (refreshing cards & 5-card maximum hand management), `OPERATIONS` (resource generation, deployment, activations, team missions), and `CLEANUP` (round-robin coin banking to card storage caps & overflow discard).
- **Tactical Operations**: Solo and multi-operative team missions for **Assassination**, **Raid**, and **Subterfuge**, with defense counter-measures (Bodyguards, Firewalls, Counterintelligence).
- **Accessibility Card Magnifier (Tabletopia Style)**: Press Spacebar while hovering, focusing, or selecting any card to display a 3x or 5x high-contrast magnified overlay with Web Speech Text-to-Speech (TTS) audio narration for visually impaired players.
- **ISMCTS AI Engine**: Deterministic Information Set Monte Carlo Tree Search agent capable of hidden information rollouts and tactical planning against human players.
- **Interactive Verification Suite**: Built-in Ability Test Lab featuring 21 discrete test scenarios across Affiliations, Locations, Operatives, Supports, and victory conditions.
- **Godot 4 GDScript Architecture**: Includes a full, matching GDScript reference implementation for Godot 4 desktop/mobile engine export.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm, pnpm, or bun

### Local Installation & Development
```bash
# Clone the repository
git clone https://github.com/yugohachiken/spywar.git
cd spywar

# Install dependencies
npm install

# Start the local development server
npm run dev
```

Visit `http://localhost:3000` (or the port specified by Vite) in your browser.

### Production Build
```bash
# Compile and build production-ready static assets
npm run build

# Preview the production build locally
npm run preview
```
The output is bundled into the `dist/` directory.

---

## Deploying to Third-Party Hosting (Vercel, Netlify, Cloudflare, etc.)

SPYWAR is a client-side Single Page Application (SPA) that can be hosted for free on any static web hosting platform:

### 1. Vercel
1. Go to [Vercel](https://vercel.com) and import your GitHub repository `yugohachiken/spywar`.
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Click **Deploy**.

### 2. Netlify
1. Go to [Netlify](https://www.netlify.com) and select **Import an existing project** from GitHub.
2. Select `yugohachiken/spywar`.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Click **Deploy SPYWAR**.

### 3. GitHub Pages
You can deploy directly to GitHub Pages using the standard Vite GitHub Pages action or static workflow pointing to the `dist` output.

---

## Online Multiplayer & Live Version

- **Live Production URL**: [spywar.vercel.app](https://spywar.vercel.app)
- **Current Version**: `v1.2.0`
- **Multiplayer Architecture**: Real-time room synchronization powered by Google Cloud Firestore with zero-login guest join, invite codes, and cross-platform mobile/desktop support.

---

## Project Roadmap

For complete details on completed phases, current milestones, and upcoming objectives (Turn Timers, Audio FX, Reconnection Resilience, Deckbuilding), see [ROADMAP.md](./ROADMAP.md).

---

## Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Database & Realtime**: Firebase Cloud Firestore
- **Icons**: Lucide React
- **Animations**: Motion
- **Build Tool**: Vite 6
- **Engine**: Custom TypeScript state machine & ISMCTS decision tree
- **Target Exports**: Web (Vite) & Godot 4 (GDScript)

---

## License
MIT
