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
  URL.revokeObjectURL(url);
}
