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
});
