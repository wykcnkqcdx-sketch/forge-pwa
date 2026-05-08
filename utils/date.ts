export function toLocalDateKey(value: Date = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function addDaysToDateKey(dateKey: string, offset: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return toLocalDateKey();
  }

  return toLocalDateKey(new Date(year, month - 1, day + offset));
}

export function getDateKey(value?: string | Date | null) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return toLocalDateKey(date);
}

export function isSameLocalDate(value: string | Date | undefined | null, dateKey: string) {
  if (typeof value === 'string' && value.startsWith(dateKey)) return true;
  return getDateKey(value) === dateKey;
}
