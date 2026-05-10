import { getAllCoaches } from '../db/coachStore';
import type { Coach } from '../db/db';
import { logTransaction } from '../db/transactionStore';

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

  const allCoaches = await getAllCoaches();
  const gymCoaches = allCoaches.filter(c => c.gymId === gymId);
  if (gymCoaches.length === 0) return;

  for (let m = 0; m < months; m++) {
    for (const coach of gymCoaches) {
      if (coach.monthlySalary <= 0) continue;
      await logTransaction({
        date: toDate,
        description: `Coach salary: ${coach.name}`,
        amount: -coach.monthlySalary,
        category: 'coach_salary',
      });
    }
  }
}
