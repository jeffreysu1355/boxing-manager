# Fight System — Implementation Roadmap

## Overview

The fight system covers everything from scheduling a fight to resolving it and collecting the payout. It is split into four sequential sub-projects, each producing working software on its own.

---

## Sub-projects

### Sub-project 1: Fight Scheduling UI
**Status:** In progress

Player picks a gym boxer, an opponent, a federation, and a date. A `Fight`, `FightContract` (basic, no negotiation), and `CalendarEvent` are created. The Calendar page becomes populated.

- [ ] Spec written
- [ ] Plan written
- [ ] Implementation complete

---

### Sub-project 2: Contract Negotiation
**Status:** Not started

Adds a payout/PPV split UI and opponent AI logic (counter-offer, reject based on reputation gap and offer quality).

- [ ] Spec written
- [ ] Plan written
- [ ] Implementation complete

---

### Sub-project 3: Fight Simulation + Post-fight
**Status:** Not started

Resolves a fight using the outcome formula (20% style matchup + 70% stats + 10% random). Updates fighter records, reputation, gym balance, and title if applicable.

- [ ] Spec written
- [ ] Plan written
- [ ] Implementation complete

---

### Sub-project 4: PPV Network Signup
**Status:** Not started

After scheduling and before the fight date, the player signs up with a PPV network. Post-fight revenue is calculated from viewership × player's contracted PPV split.

- [ ] Spec written
- [ ] Plan written
- [ ] Implementation complete
