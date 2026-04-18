# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Vite dev server (hot reload)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally

## Project Overview

Boxing Manager is a single-page web application where users manage a boxing gym, recruit and train boxers, schedule fights, and earn money to upgrade their gym. The game is inspired by football-gm.com's UI design and runs entirely client-side using IndexedDB for storage.

## Technical Architecture

### Storage & Data Layer
- **Client-side only**: All game logic and data management happens in the browser
- **IndexedDB**: Primary storage mechanism for game state
- **Potential pattern**: Shared worker to communicate with IndexedDB, with a cache layer for frequently accessed data (evaluate if this pattern fits the use case)

### Technology Stack
- Vite + React 18 + TypeScript SPA
- React Router v7 for client-side navigation with nested routes
- CSS Modules for component-scoped styling with global dark theme
- Text-based UI, no images initially
- UI design inspired by https://play.football-gm.com/

## Core Game Mechanics

### Gym System
- 10 gym levels (level 10 costs $100,000,000)
- Higher levels unlock better recruits and training equipment
- All money flows to the gym, not individual boxers

### Boxer System

**Weight Classes**: Flyweight (126 lbs), Lightweight (135 lbs), Welterweight (147 lbs), Middleweight (160 lbs), Heavyweight (200+ lbs)

**Reputation Levels** (in order): Unknown, Local Star, Rising Star, Respectable Opponent, Contender, Championship Caliber, Nationally Ranked, World Class Fighter, International Superstar, All-Time Great

**Fighting Styles** (rock-paper-scissors counters):
- Out-Boxer → countered by Swarmer
- Swarmer → countered by Slugger
- Slugger → countered by Counterpuncher
- Counterpuncher → countered by Out-Boxer

**Stats**: Each boxer has stats (1-20 scale, max 25 with natural talent) in 4 categories:
- Offense: Jab, Cross, Lead Hook, Rear Hook, Uppercut, etc.
- Defense: Head Movement, Body Movement, Guard, Positioning
- Mental: Timing, Adaptability, Discipline
- Physical: Speed, Power, Endurance, Recovery, Toughness

Each style focuses on specific stats (see BoxingManagerRequirements.txt lines 10-13).

**Boxer Data Tracking**:
- Natural Talents (randomly generated or earned through training)
- Injuries (from training or matches)
- Titles held with date ranges
- Professional Record in format: "Win: Zach Pitt - KO (Rear Hook) - Rd. 1 (1:34) - North America Boxing Federation - April 14 2026"

### Coach System
- Skill levels: Local, Contender, Championship Caliber, All Time Great
- Each coach specializes in a fighting style
- Training mechanics:
  - During season: Boxers gain exp per day in coach's specialty stats
  - Pre-fight: Training gives 300% temporary stat boost (scales with training days)

### Fight System

**Organizations**: North America BF, South America BF, African BF, European BF, Asia BF, Oceania BF, International BF (most prestigious)
- Each hosts 4 events per year
- Each has titles for every weight class

**Contract Negotiation**:
- Guaranteed payout (increments: $1k-$10k by $1k, $10k-$100k by $10k, $100k-$1M by $100k)
- PPV/Network split percentage
- Title fight option (winner takes title)
- Opponent can counter-offer, lower payout, or reject based on reputation/money

**PPV Networks**: Sign up between scheduling and fight; expect 60% of network viewers (higher for title fights)

**Fight Outcome Formula**: 20% fighter type matchup + 70% stats + 10% random

## UI Structure

Main navigation tabs (same level as League/Gym/Players):

**League**:
- Standings: Current titles and contenders by federation and weight class
- Calendar: Upcoming fights for gym members

**Gym**:
- Roster: Current members with next fight, status, detailed stats on click
- Finances: Current gym level and finances
- Coaches: Current coaches and their assigned boxers

**Players**:
- Recruiting: Under-18 prospects with stats and youth boxing history
- Compare: Side-by-side fighter comparison tool

**Tools**:
- God Mode: Modify stats/natural talents/history

## Reference Materials

See `references/` directory for UI inspiration screenshots from football-gm and World Boxing Manager.
