import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, closeAndResetDB } from './db';

describe('getDB', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('opens a database named boxing-manager', async () => {
    const db = await getDB();
    expect(db.name).toBe('boxing-manager');
  });

  it('creates the boxers object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('boxers')).toBe(true);
  });

  it('creates the coaches object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('coaches')).toBe(true);
  });

  it('creates the gym object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('gym')).toBe(true);
  });

  it('creates a weightClass index on the boxers store', async () => {
    const db = await getDB();
    const tx = db.transaction('boxers', 'readonly');
    expect(tx.store.indexNames.contains('weightClass')).toBe(true);
  });

  it('creates a style index on the coaches store', async () => {
    const db = await getDB();
    const tx = db.transaction('coaches', 'readonly');
    expect(tx.store.indexNames.contains('style')).toBe(true);
  });

  it('returns the same instance on repeated calls', async () => {
    const db1 = await getDB();
    const db2 = await getDB();
    expect(db1).toBe(db2);
  });

  it('returns a new instance after closeAndResetDB', async () => {
    const db1 = await getDB();
    await closeAndResetDB();
    global.indexedDB = new IDBFactory();
    const db2 = await getDB();
    expect(db1).not.toBe(db2);
  });

  it('creates the federations object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('federations')).toBe(true);
  });

  it('creates the fights object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('fights')).toBe(true);
  });

  it('creates the fightContracts object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('fightContracts')).toBe(true);
  });

  it('creates the ppvNetworks object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('ppvNetworks')).toBe(true);
  });

  it('creates the titles object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('titles')).toBe(true);
  });

  it('creates the calendarEvents object store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('calendarEvents')).toBe(true);
  });

  it('creates federationId and weightClass indexes on titles store', async () => {
    const db = await getDB();
    const tx = db.transaction('titles', 'readonly');
    expect(tx.store.indexNames.contains('federationId')).toBe(true);
    expect(tx.store.indexNames.contains('weightClass')).toBe(true);
  });

  it('creates type, date, boxerIds, fightId indexes on calendarEvents store', async () => {
    const db = await getDB();
    const tx = db.transaction('calendarEvents', 'readonly');
    expect(tx.store.indexNames.contains('type')).toBe(true);
    expect(tx.store.indexNames.contains('date')).toBe(true);
    expect(tx.store.indexNames.contains('boxerIds')).toBe(true);
    expect(tx.store.indexNames.contains('fightId')).toBe(true);
  });
});
