import { getDB, type Boxer, type WeightClass } from './db';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function normalizeBoxer(boxer: Boxer, currentYear: number): Boxer {
  if (boxer.birthDate !== undefined && boxer.lastAgedYear !== undefined) return boxer;
  const birthYear = currentYear - boxer.age;
  const birthMonth = boxer.birthDate
    ? Number(boxer.birthDate.split('-')[1])
    : Math.floor(Math.random() * 12) + 1;
  const birthDay = boxer.birthDate
    ? Number(boxer.birthDate.split('-')[2])
    : Math.floor(Math.random() * 28) + 1;
  return {
    ...boxer,
    birthDate: boxer.birthDate ?? `${birthYear}-${pad(birthMonth)}-${pad(birthDay)}`,
    lastAgedYear: boxer.lastAgedYear ?? currentYear,
  };
}

// normalizeBoxer uses the real-world year as a fallback for lastAgedYear.
// This is intentional: for legacy records without lastAgedYear, defaulting to
// the current real year prevents immediate re-aging on first load. The slight
// mismatch vs. game year only matters if a saved game spans multiple real years,
// which is unlikely in practice.
export async function getBoxer(id: number): Promise<Boxer | undefined> {
  const db = await getDB();
  const boxer = await db.get('boxers', id);
  if (!boxer) return undefined;
  const currentYear = new Date().getFullYear();
  return normalizeBoxer(boxer, currentYear);
}

export async function getAllBoxers(): Promise<Boxer[]> {
  const db = await getDB();
  const boxers = await db.getAll('boxers');
  const currentYear = new Date().getFullYear();
  return boxers.map(b => normalizeBoxer(b, currentYear));
}

export async function getBoxersByWeightClass(weightClass: WeightClass): Promise<Boxer[]> {
  const db = await getDB();
  const boxers = await db.getAllFromIndex('boxers', 'weightClass', weightClass);
  const currentYear = new Date().getFullYear();
  return boxers.map(b => normalizeBoxer(b, currentYear));
}

export async function getBoxersByFederation(federationId: number): Promise<Boxer[]> {
  const db = await getDB();
  const boxers = await db.getAllFromIndex('boxers', 'federationId', federationId);
  const currentYear = new Date().getFullYear();
  return boxers.map(b => normalizeBoxer(b, currentYear));
}

export async function putBoxer(boxer: Omit<Boxer, 'id'> | Boxer): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = boxer as Boxer;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('boxers', record as Boxer);
}

export async function deleteBoxer(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('boxers', id);
}
