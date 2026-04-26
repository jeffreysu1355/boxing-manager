import { getDB, type PpvNetwork } from './db';

export async function getPpvNetwork(id: number): Promise<PpvNetwork | undefined> {
  const db = await getDB();
  return db.get('ppvNetworks', id);
}

export async function getAllPpvNetworks(): Promise<PpvNetwork[]> {
  const db = await getDB();
  return db.getAll('ppvNetworks');
}

export async function putPpvNetwork(network: Omit<PpvNetwork, 'id'> | PpvNetwork): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = network as PpvNetwork;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('ppvNetworks', record as PpvNetwork);
}

export async function deletePpvNetwork(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('ppvNetworks', id);
}

export async function getPpvNetworksByFederation(federationId: number): Promise<PpvNetwork[]> {
  const all = await getAllPpvNetworks();
  return all.filter(n => n.federationId === federationId);
}
