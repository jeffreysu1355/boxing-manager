import { getDB, type FightContract, type ContractStatus } from './db';

export async function getFightContract(id: number): Promise<FightContract | undefined> {
  const db = await getDB();
  return db.get('fightContracts', id);
}

export async function getAllFightContracts(): Promise<FightContract[]> {
  const db = await getDB();
  return db.getAll('fightContracts');
}

export async function getFightContractsByBoxer(boxerId: number): Promise<FightContract[]> {
  const db = await getDB();
  return db.getAllFromIndex('fightContracts', 'boxerId', boxerId);
}

export async function getFightContractsByStatus(status: ContractStatus): Promise<FightContract[]> {
  const db = await getDB();
  return db.getAllFromIndex('fightContracts', 'status', status);
}

export async function putFightContract(contract: Omit<FightContract, 'id'> | FightContract): Promise<number> {
  const db = await getDB();
  const { id, ...rest } = contract as FightContract;
  const record = id !== undefined ? { ...rest, id } : rest;
  return db.put('fightContracts', record as FightContract);
}

export async function deleteFightContract(id: number): Promise<void> {
  const db = await getDB();
  return db.delete('fightContracts', id);
}
