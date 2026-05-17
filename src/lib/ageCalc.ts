export function calcAgeAtDate(birthDate: string | undefined, fightDate: string): string {
  if (!birthDate) return '—';

  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [fy, fm, fd] = fightDate.split('-').map(Number);

  let years = fy - by;
  let months = fm - bm;

  if (fd < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years}y ${months}m`;
}
