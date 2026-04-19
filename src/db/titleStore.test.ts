import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeAndResetDB, type Title } from './db';
import {
  getTitle,
  getAllTitles,
  getTitlesByFederation,
  getTitlesByWeightClass,
  putTitle,
  deleteTitle,
} from './titleStore';

const baseTitle: Omit<Title, 'id'> = {
  federationId: 1,
  weightClass: 'lightweight',
  currentChampionId: null,
  reigns: [],
};

describe('titleStore', () => {
  beforeEach(() => {
    global.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await closeAndResetDB();
  });

  it('putTitle inserts a new title and returns its id', async () => {
    const id = await putTitle(baseTitle);
    expect(id).toBe(1);
  });

  it('putTitle assigns incrementing ids', async () => {
    const id1 = await putTitle(baseTitle);
    const id2 = await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    expect(id1).toBe(1);
    expect(id2).toBe(2);
  });

  it('getTitle retrieves a title by id', async () => {
    const id = await putTitle(baseTitle);
    const title = await getTitle(id);
    expect(title?.weightClass).toBe('lightweight');
    expect(title?.id).toBe(id);
  });

  it('getTitle returns undefined for a missing id', async () => {
    const title = await getTitle(999);
    expect(title).toBeUndefined();
  });

  it('getAllTitles returns all stored titles', async () => {
    await putTitle(baseTitle);
    await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    const titles = await getAllTitles();
    expect(titles).toHaveLength(2);
  });

  it('getAllTitles returns an empty array when no titles exist', async () => {
    const titles = await getAllTitles();
    expect(titles).toHaveLength(0);
  });

  it('getTitlesByFederation returns only titles for that federation', async () => {
    await putTitle(baseTitle); // federationId: 1
    await putTitle({ ...baseTitle, federationId: 2, weightClass: 'heavyweight' });
    const fed1Titles = await getTitlesByFederation(1);
    expect(fed1Titles).toHaveLength(1);
    expect(fed1Titles[0].federationId).toBe(1);
  });

  it('getTitlesByFederation returns empty array when no matches', async () => {
    await putTitle(baseTitle);
    const result = await getTitlesByFederation(99);
    expect(result).toHaveLength(0);
  });

  it('getTitlesByWeightClass returns only titles of that weight class', async () => {
    await putTitle(baseTitle); // lightweight
    await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    const lightweights = await getTitlesByWeightClass('lightweight');
    expect(lightweights).toHaveLength(1);
    expect(lightweights[0].weightClass).toBe('lightweight');
  });

  it('getTitlesByWeightClass returns empty array when no matches', async () => {
    await putTitle(baseTitle);
    const result = await getTitlesByWeightClass('flyweight');
    expect(result).toHaveLength(0);
  });

  it('putTitle updates an existing title when id is present', async () => {
    const id = await putTitle(baseTitle);
    await putTitle({ ...baseTitle, id, currentChampionId: 42 });
    const title = await getTitle(id);
    expect(title?.currentChampionId).toBe(42);
  });

  it('putTitle stores reigns and currentChampionId', async () => {
    const reign = { boxerId: 7, dateWon: '2026-01-01', dateLost: null, defenseCount: 2 };
    const id = await putTitle({ ...baseTitle, currentChampionId: 7, reigns: [reign] });
    const title = await getTitle(id);
    expect(title?.reigns).toHaveLength(1);
    expect(title?.reigns[0].boxerId).toBe(7);
    expect(title?.reigns[0].defenseCount).toBe(2);
  });

  it('putTitle with id: undefined inserts as a new title', async () => {
    const id = await putTitle({ ...baseTitle, id: undefined });
    expect(id).toBe(1);
  });

  it('deleteTitle removes a title by id', async () => {
    const id = await putTitle(baseTitle);
    await deleteTitle(id);
    const title = await getTitle(id);
    expect(title).toBeUndefined();
  });

  it('deleteTitle does not affect other titles', async () => {
    const id1 = await putTitle(baseTitle);
    const id2 = await putTitle({ ...baseTitle, weightClass: 'heavyweight' });
    await deleteTitle(id1);
    const remaining = await getAllTitles();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id2);
  });
});
