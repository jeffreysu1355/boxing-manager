# Styling Redesign: shadcn/ui + Tailwind + Charcoal Theme

## Overview

Replace the current CSS Modules + CSS custom properties setup with shadcn/ui components and Tailwind CSS v4. The goal is a unified design system with consistent buttons, badges, cards, and tables — and a charcoal/slate dark color scheme with orange accent replacing the current navy/red palette.

All work happens on the `styling/charcoal-theme` branch so it can be previewed before merging.

## Architecture & Stack

- **Tailwind CSS v4** — utility-first CSS, handles all layout/spacing
- **shadcn/ui** — copy-paste component library built on Radix UI primitives; components live in `src/components/ui/` and are fully owned/editable
- **CSS Modules** — kept in place during migration; coexist with Tailwind until replaced page by page
- No new runtime bundle weight from shadcn (zero-runtime; Tailwind generates only used classes)

## Color Scheme

Charcoal/slate palette using Tailwind zinc scale:

| Role | Token | Value |
|---|---|---|
| Background primary | `zinc-950` | `#09090b` |
| Background secondary | `zinc-900` | `#18181b` |
| Surface/panels | `zinc-800` | `#27272a` |
| Border | `zinc-700` | `#3f3f46` |
| Text primary | `zinc-50` | `#fafafa` |
| Text secondary | `zinc-400` | `#a1a1aa` |
| Accent | `orange-500` | `#f97316` |
| Success | `green-500` | `#22c55e` |
| Danger | `red-500` | `#ef4444` |
| Warning | `yellow-500` | `#eab308` |

Orange replaces red as the accent — red was reading as "error state" rather than brand color.

## Components to Migrate (Priority Order)

1. **Button** — replace all inline button styles across 10+ files with a single shared `<Button>` component
2. **Badge** — replace `.titleBadge` and `.talentTag` scattered across pages
3. **Card** — replace the repeated `bg-secondary + border + border-radius + overflow:hidden` panel pattern (PlayerPage, Roster, Finances, etc.)
4. **Table** — replace global `table/th/td` styles in `index.css` with a proper `<Table>` component
5. **TopNav & Sidebar** — restyle with Tailwind utilities, keeping existing layout structure (grid with nav + sidebar + content)

## Migration Strategy

- CSS Modules and Tailwind coexist — replace page by page, not all at once
- Start with **PlayerPage** and **Roster** as representative pages to establish patterns
- Remaining pages follow the same pattern once those are validated
- `index.css` global table styles get removed once `<Table>` component is adopted everywhere

## Information Density

Keep the football-gm-style density: small font (13px base), tight table rows, lots of info visible at once. shadcn components will be configured with compact sizing — not the default spacious style.

## Out of Scope

- Game logic or data layer changes
- Adding new pages or features
- Full Tailwind migration of every page (ship PlayerPage + Roster first, rest follows)
