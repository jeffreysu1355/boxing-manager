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
  name: string;
  affectedStats: (keyof BoxerStats)[];
}

export interface Injury {
  name: string;
  severity: 'minor' | 'moderate' | 'severe';
  recoveryDays: number;
  dateOccurred: string;
}

export interface TitleRecord {
  titleId: number;
  federationId: number;
  weightClass: WeightClass;
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

// --- Entity interfaces ---

export interface Boxer {
  id?: number;
  name: string;
  age: number;
  weightClass: WeightClass;
  style: FightingStyle;
  reputation: ReputationLevel;
  gymId: number | null;
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
}

// --- DB schema ---

interface BoxingManagerDBSchema extends DBSchema {
  boxers: {
    key: number;
    value: Boxer;
    indexes: { weightClass: WeightClass };
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
}

export type DB = IDBPDatabase<BoxingManagerDBSchema>;

// --- DB singleton ---

let dbInstance: DB | null = null;

export async function getDB(): Promise<DB> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<BoxingManagerDBSchema>('boxing-manager', 1, {
    upgrade(db) {
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
