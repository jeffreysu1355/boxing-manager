import { getDB } from './db';

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  exportedAt: string;
  stores: {
    boxers: unknown[];
    coaches: unknown[];
    gym: unknown[];
    federations: unknown[];
    fights: unknown[];
    fightContracts: unknown[];
    ppvNetworks: unknown[];
    titles: unknown[];
    calendarEvents: unknown[];
    federationEvents: unknown[];
    transactions: unknown[];
  };
}

export async function exportSave(): Promise<void> {
  try {
    const db = await getDB();
    const save: SaveFile = {
      version: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
      stores: {
        boxers:           await db.getAll('boxers'),
        coaches:          await db.getAll('coaches'),
        gym:              await db.getAll('gym'),
        federations:      await db.getAll('federations'),
        fights:           await db.getAll('fights'),
        fightContracts:   await db.getAll('fightContracts'),
        ppvNetworks:      await db.getAll('ppvNetworks'),
        titles:           await db.getAll('titles'),
        calendarEvents:   await db.getAll('calendarEvents'),
        federationEvents: await db.getAll('federationEvents'),
        transactions:     await db.getAll('transactions'),
      },
    };

    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `boxing-manager-save-${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (err) {
    console.error('Failed to export save:', err);
    alert('Failed to export save. Please try again.');
  }
}

export type ImportResult =
  | { ok: true; versionMismatch: false }
  | { ok: true; versionMismatch: true; fileVersion: number }
  | { ok: false; error: string };

function isObjectArray(arr: unknown): arr is object[] {
  return Array.isArray(arr) && arr.every(r => typeof r === 'object' && r !== null);
}

export async function importSave(file: File): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('stores' in parsed) ||
    typeof (parsed as SaveFile).stores !== 'object'
  ) {
    return { ok: false, error: 'File does not look like a Boxing Manager save.' };
  }

  const s = (parsed as SaveFile).stores;
  const storeNames = [
    'boxers','coaches','gym','federations','fights','fightContracts',
    'ppvNetworks','titles','calendarEvents','federationEvents','transactions',
  ] as const;
  for (const name of storeNames) {
    if (!isObjectArray((s as Record<string, unknown>)[name])) {
      return { ok: false, error: `Invalid save: "${name}" store is not an array of objects.` };
    }
  }

  const save = parsed as SaveFile;
  const versionMismatch = save.version !== SAVE_VERSION;

  try {
    const db = await getDB();
    const tx = db.transaction(
      ['boxers','coaches','gym','federations','fights','fightContracts',
       'ppvNetworks','titles','calendarEvents','federationEvents','transactions'],
      'readwrite',
    );

    await Promise.all([
      tx.objectStore('boxers').clear(),
      tx.objectStore('coaches').clear(),
      tx.objectStore('gym').clear(),
      tx.objectStore('federations').clear(),
      tx.objectStore('fights').clear(),
      tx.objectStore('fightContracts').clear(),
      tx.objectStore('ppvNetworks').clear(),
      tx.objectStore('titles').clear(),
      tx.objectStore('calendarEvents').clear(),
      tx.objectStore('federationEvents').clear(),
      tx.objectStore('transactions').clear(),
    ]);

    await Promise.all([
      ...(s.boxers           as object[]).map(r => tx.objectStore('boxers').put(r as never)),
      ...(s.coaches          as object[]).map(r => tx.objectStore('coaches').put(r as never)),
      ...(s.gym              as object[]).map(r => tx.objectStore('gym').put(r as never)),
      ...(s.federations      as object[]).map(r => tx.objectStore('federations').put(r as never)),
      ...(s.fights           as object[]).map(r => tx.objectStore('fights').put(r as never)),
      ...(s.fightContracts   as object[]).map(r => tx.objectStore('fightContracts').put(r as never)),
      ...(s.ppvNetworks      as object[]).map(r => tx.objectStore('ppvNetworks').put(r as never)),
      ...(s.titles           as object[]).map(r => tx.objectStore('titles').put(r as never)),
      ...(s.calendarEvents   as object[]).map(r => tx.objectStore('calendarEvents').put(r as never)),
      ...(s.federationEvents as object[]).map(r => tx.objectStore('federationEvents').put(r as never)),
      ...(s.transactions     as object[]).map(r => tx.objectStore('transactions').put(r as never)),
    ]);

    await tx.done;
  } catch (err) {
    return { ok: false, error: `Import failed: ${String(err)}` };
  }

  return versionMismatch
    ? { ok: true, versionMismatch: true, fileVersion: save.version }
    : { ok: true, versionMismatch: false };
}
