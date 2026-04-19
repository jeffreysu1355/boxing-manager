import { getAllBoxers } from './boxerStore';
import { getAllFederations } from './federationStore';
import { generateWorld } from './worldGen';

export async function initGameIfNeeded(): Promise<void> {
  const [boxers, federations] = await Promise.all([getAllBoxers(), getAllFederations()]);

  if (boxers.length === 0 && federations.length === 0) {
    await generateWorld();
  }
}
