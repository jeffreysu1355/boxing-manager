export function shouldAgeBoxer(
  birthDate: string,
  lastAgedYear: number,
  newYear: number,
  newMonth: number,
): boolean {
  if (newYear <= lastAgedYear) return false;
  const birthMonth = Number(birthDate.split('-')[1]);
  return newMonth >= birthMonth;
}
