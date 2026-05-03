import { getAllCoaches } from '../db/coachStore';
import { getGym, saveGym } from '../db/gymStore';
import type { Coach } from '../db/db';

export function countMonthsElapsed(fromDate: string, toDate: string): number {
  const [fy, fm] = fromDate.split('-').map(Number);
  const [ty, tm] = toDate.split('-').map(Number);
  return Math.max(0, (ty * 12 + tm) - (fy * 12 + fm));
}

export function calcTotalMonthlySalary(coaches: Coach[], gymId: number): number {
  return coaches
    .filter(c => c.gymId === gymId)
    .reduce((sum, c) => sum + c.monthlySalary, 0);
}

export async function runCoachSalaries(
  fromDate: string,
  toDate: string,
  gymId: number,
): Promise<void> {
  const months = countMonthsElapsed(fromDate, toDate);
  if (months === 0) return;

  const [gym, allCoaches] = await Promise.all([getGym(), getAllCoaches()]);
  if (!gym) return;

  const totalPerMonth = calcTotalMonthlySalary(allCoaches, gymId);
  const deduction = totalPerMonth * months;
  if (deduction === 0) return;

  await saveGym({ ...gym, balance: gym.balance - deduction });
}
