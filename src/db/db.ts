import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// --- Supporting types ---

export type WeightClass =
  | 'flyweight'
  | 'lightweight'
  | 'welterweight'
  | 'middleweight'
  | 'heavyweight';

export type FightingStyle = 'out-boxer' | 'swarmer' | 'slugger' | 'counterpuncher';

export type ReputationLevel =
  | 'Unknown'
  | 'Local Star'
  | 'Rising Star'
  | 'Respectable Opponent'
  | 'Contender'
  | 'Championship Caliber'
  | 'Nationally Ranked'
  | 'World Class Fighter'
  | 'International Superstar'
  | 'All-Time Great';

export type CoachSkillLevel =
  | 'local'
  | 'contender'
  | 'championship-caliber'
  | 'all-time-great';

export type FederationName =
  | 'North America Boxing Federation'
  | 'South America Boxing Federation'
  | 'African Boxing Federation'
  | 'European Boxing Federation'
  | 'Asia Boxing Federation'
  | 'Oceania Boxing Federation'
  | 'International Boxing Federation';

export type FightMethod = 'KO' | 'TKO' | 'Decision' | 'Split Decision' | 'Draw';

export type ContractStatus = 'pending' | 'accepted' | 'countered' | 'rejected' | 'completed';

export interface BoxerStats {
  // Offense
  jab: number;
  cross: number;
  leadHook: number;
  rearHook: number;
  uppercut: number;
  // Defense
  headMovement: number;
  bodyMovement: number;
  guard: number;
  positioning: number;
  // Mental
  timing: number;
  adaptability: number;
  discipline: number;
  // Physical
  speed: number;
  power: number;
  endurance: number;
  recovery: number;
  toughness: number;
}

export interface NaturalTalent {
  stat: keyof BoxerStats; // display name = `Super ${capitalize(stat)}`; raises cap from 20 → 25
}

export interface Injury {
  name: string;
  severity: 'minor' | 'moderate' | 'severe';
  recoveryDays: number;
  dateOccurred: string;
}

export interface TitleRecord {
  titleId: number;
  dateWon: string;
  dateLost: string | null;
}

export interface FightRecord {
  result: 'win' | 'loss' | 'draw';
  opponentName: string;
  method: string;
  finishingMove: string | null;
  round: number;
  time: string;
  federation: string;
  date: string;
}

export interface TitleReign {
  boxerId: number;
  dateWon: string;
  dateLost: string | null;
  defenseCount: number;
}

export interface Title {
  id?: number;
  federationId: number;
  weightClass: WeightClass;
  currentChampionId: number | null;
  reigns: TitleReign[];
}

export type CalendarEventType = 'fight' | 'training-camp';

export interface CalendarEvent {
  id?: number;
  type: CalendarEventType;
  date: string;        // fight date OR training camp start date (ISO)
  boxerIds: number[];  // multi-entry indexed; single element for training-camp
  fightId: number;     // 'fight': the fight itself; 'training-camp': the fight being prepped for
  endDate?: string;    // training-camp only (ISO)
  intensityLevel?: 'light' | 'moderate' | 'intense'; // training-camp only
}

// --- Entity interfaces ---

export interface Boxer {
  id?: number;
  name: string;
  age: number;
  weightClass: WeightClass;
  style: FightingStyle;
  reputation: ReputationLevel;
  gymId: number | null;
  federationId: number | null;
  stats: BoxerStats;
  naturalTalents: NaturalTalent[];
  injuries: Injury[];
  titles: TitleRecord[];
  record: FightRecord[];
}

export interface Coach {
  id?: number;
  name: string;
  skillLevel: CoachSkillLevel;
  style: FightingStyle;
  assignedBoxerId: number | null;
}

export interface Gym {
  id?: number;
  name: string;
  level: number;
  balance: number;
  rosterIds: number[];
  coachIds: number[];
  currentDate: string; // ISO date, e.g. '2026-01-01'
}

export interface Federation {
  id?: number;
  name: FederationName;
  prestige: number; // 1-10, International BF = 10
}

export interface Fight {
  id?: number;
  date: string;
  federationId: number;
  weightClass: WeightClass;
  boxerIds: number[]; // [boxer1Id, boxer2Id], multiEntry indexed
  winnerId: number | null; // null = draw
  method: FightMethod;
  finishingMove: string | null;
  round: number | null; // null for decisions
  time: string | null; // null for decisions
  isTitleFight: boolean;
  contractId: number;
}

export interface FightContract {
  id?: number;
  boxerId: number;
  opponentId: number;
  federationId: number;
  weightClass: WeightClass;
  guaranteedPayout: number;
  ppvSplitPercentage: number; // player's share (0–100)
  ppvNetworkId: number | null;
  isTitleFight: boolean;
  status: ContractStatus;
  counterOfferPayout: number | null; // set when opponent counter-offers
  counterOfferPpvSplit: number | null; // opponent's counter PPV split; null = not changed
  roundsUsed: number; // 0..3, incremented each time player submits
  scheduledDate: string | null;
  fightId: number | null; // set after fight completes
}

export interface PpvNetwork {
  id?: number;
  name: string;
  baseViewership: number;
  titleFightMultiplier: number; // multiplier applied for title fights
  playerRevenueShare: number; // percentage (0–100) player earns
  contractedBoxerId: number | null;
  contractStart: string | null;
  contractEnd: string | null;
}

export interface FederationEvent {
  id?: number;
  federationId: number;
  date: string;        // ISO date, e.g. '2026-03-14'
  name: string;        // e.g. 'NABF March 2026'
  fightIds: number[];  // fight ids on this card
}

// --- DB schema ---

interface BoxingManagerDBSchema extends DBSchema {
  boxers: {
    key: number;
    value: Boxer;
    indexes: { weightClass: WeightClass; federationId: number };
  };
  coaches: {
    key: number;
    value: Coach;
    indexes: { style: FightingStyle };
  };
  gym: {
    key: number;
    value: Gym;
  };
  federations: {
    key: number;
    value: Federation;
    indexes: { name: FederationName };
  };
  fights: {
    key: number;
    value: Fight;
    indexes: { boxerIds: number; federationId: number };
  };
  fightContracts: {
    key: number;
    value: FightContract;
    indexes: { boxerId: number; status: ContractStatus };
  };
  ppvNetworks: {
    key: number;
    value: PpvNetwork;
  };
  titles: {
    key: number;
    value: Title;
    indexes: { federationId: number; weightClass: WeightClass };
  };
  calendarEvents: {
    key: number;
    value: CalendarEvent;
    indexes: { type: CalendarEventType; date: string; boxerIds: number; fightId: number };
  };
  federationEvents: {
    key: number;
    value: FederationEvent;
    indexes: { federationId: number; date: string };
  };
}

export type DB = IDBPDatabase<BoxingManagerDBSchema>;

// --- DB singleton ---

let dbInstance: DB | null = null;

export async function getDB(): Promise<DB> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 7, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const boxerStore = db.createObjectStore('boxers', {
          keyPath: 'id',
          autoIncrement: true,
        });
        boxerStore.createIndex('weightClass', 'weightClass');

        const coachStore = db.createObjectStore('coaches', {
          keyPath: 'id',
          autoIncrement: true,
        });
        coachStore.createIndex('style', 'style');

        db.createObjectStore('gym', { keyPath: 'id' });
      }

      if (oldVersion < 2) {
        const federationStore = db.createObjectStore('federations', {
          keyPath: 'id',
          autoIncrement: true,
        });
        federationStore.createIndex('name', 'name', { unique: true });

        const fightStore = db.createObjectStore('fights', {
          keyPath: 'id',
          autoIncrement: true,
        });
        fightStore.createIndex('boxerIds', 'boxerIds', { multiEntry: true });
        fightStore.createIndex('federationId', 'federationId');

        const contractStore = db.createObjectStore('fightContracts', {
          keyPath: 'id',
          autoIncrement: true,
        });
        contractStore.createIndex('boxerId', 'boxerId');
        contractStore.createIndex('status', 'status');

        db.createObjectStore('ppvNetworks', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }

      if (oldVersion < 3) {
        const titleStore = db.createObjectStore('titles', {
          keyPath: 'id',
          autoIncrement: true,
        });
        titleStore.createIndex('federationId', 'federationId');
        titleStore.createIndex('weightClass', 'weightClass');

        const calendarEventStore = db.createObjectStore('calendarEvents', {
          keyPath: 'id',
          autoIncrement: true,
        });
        calendarEventStore.createIndex('type', 'type');
        calendarEventStore.createIndex('date', 'date');
        calendarEventStore.createIndex('boxerIds', 'boxerIds', { multiEntry: true });
        calendarEventStore.createIndex('fightId', 'fightId');
      }

      if (oldVersion < 4) {
        const store = transaction.objectStore('boxers');
        store.createIndex('federationId', 'federationId');
      }

      if (oldVersion < 5) {
        const fedEventStore = db.createObjectStore('federationEvents', {
          keyPath: 'id',
          autoIncrement: true,
        });
        fedEventStore.createIndex('federationId', 'federationId');
        fedEventStore.createIndex('date', 'date');
      }

      if (oldVersion < 6) {
        // counterOfferPpvSplit and roundsUsed added to fightContracts
        // idb returns undefined for missing fields on existing records;
        // runtime code treats undefined as null / 0 respectively
      }

      if (oldVersion < 7) {
        // currentDate added to Gym; existing records without this field
        // will return undefined — runtime code defaults to '2026-01-01'
      }
    },
  });
  return dbInstance;
}

export async function closeAndResetDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
