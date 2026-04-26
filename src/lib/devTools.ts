import { getDB } from '../db/db';
import { computeStatScore, computeStyleScore, computeRandomWeight } from './fightSim';

async function dbGet<T>(store: string, id: number): Promise<T | undefined> {
  const db = await getDB();
  return (db as any).get(store, id);
}

async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await getDB();
  return (db as any).getAll(store);
}

async function boxer(id: number) {
  const b = await dbGet<any>('boxers', id);
  if (!b) { console.log(`No boxer with id ${id}`); return; }
  console.log(`[${id}] ${b.name} | ${b.reputation} | ${b.style} | ${b.weightClass}`);
  console.table(b.stats);
  console.log('Record:', b.record.length, 'fights');
  return b;
}

async function allBoxers() {
  const all = await dbGetAll<any>('boxers');
  console.table(all.map((b: any) => ({ id: b.id, name: b.name, reputation: b.reputation, style: b.style, wins: b.record.filter((r: any) => r.result === 'win').length, losses: b.record.filter((r: any) => r.result === 'loss').length })));
  return all;
}

async function simCalc(idA: number, idB: number) {
  const [a, b] = await Promise.all([dbGet<any>('boxers', idA), dbGet<any>('boxers', idB)]);
  if (!a) { console.log(`No boxer with id ${idA}`); return; }
  if (!b) { console.log(`No boxer with id ${idB}`); return; }

  const statA = computeStatScore(a);
  const statB = computeStatScore(b);
  const styleScore = computeStyleScore(a.style, b.style);
  const REPUTATION_INDEX: Record<string, number> = { 'Unknown': 0, 'Local Star': 1, 'Rising Star': 2, 'Respectable Opponent': 3, 'Contender': 4, 'Championship Caliber': 5, 'Nationally Ranked': 6, 'World Class Fighter': 7, 'International Superstar': 8, 'All-Time Great': 9 };
  const tierGap = Math.abs(REPUTATION_INDEX[a.reputation] - REPUTATION_INDEX[b.reputation]);
  const randomWeight = computeRandomWeight(tierGap);
  const statDiff = statA - statB;
  const styleAdj = (styleScore - 0.5) * 0.20;
  const minWinProb = Math.min(1, Math.max(0, 0.5 + statDiff * 0.85 + styleAdj - randomWeight / 2));
  const maxWinProb = Math.min(1, Math.max(0, 0.5 + statDiff * 0.85 + styleAdj + randomWeight / 2));

  console.log(`\n=== Fight Sim: ${a.name} (A) vs ${b.name} (B) ===`);
  console.log(`A: ${a.reputation} ${a.style} | statScore=${statA.toFixed(4)}`);
  console.log(`B: ${b.reputation} ${b.style} | statScore=${statB.toFixed(4)}`);
  console.log(`statDiff (A - B): ${statDiff.toFixed(4)}`);
  console.log(`styleScore (A): ${styleScore} → styleAdj=${styleAdj.toFixed(4)}`);
  console.log(`tierGap: ${tierGap} → randomWeight: ${randomWeight.toFixed(4)} (±${(randomWeight/2).toFixed(4)})`);
  console.log(`winProbA range: ${minWinProb.toFixed(4)} – ${maxWinProb.toFixed(4)}`);
  console.log(`→ A (${a.name}) wins ${(((minWinProb + maxWinProb) / 2) * 100).toFixed(1)}% on average`);
}

async function fight(id: number) {
  const f = await dbGet<any>('fights', id);
  if (!f) { console.log(`No fight with id ${id}`); return; }
  console.log(f);
  return f;
}

async function allFights() {
  const all = await dbGetAll<any>('fights');
  console.table(all.map((f: any) => ({ id: f.id, date: f.date, boxerIds: f.boxerIds.join(' vs '), winnerId: f.winnerId, method: f.method, round: f.round })));
  return all;
}

export const dev = {
  boxer,
  allBoxers,
  simCalc,
  fight,
  allFights,
};
