// Date Parse Utilities
export function parseDateInput(input: string): Date | null {
  // Try ISO format first
  const iso = new Date(input);
  if (!isNaN(iso.getTime())) return iso;

  // Try DD/MM/YYYY
  const ddmmyyyy = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  // Try YYYY-MM-DD
  const yyyymmdd = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return null;
}

export function formatForInput(date: Date): string {
  // YYYY-MM-DD for HTML date inputs
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeForInput(date: Date): string {
  // HH:MM for HTML time inputs
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function combineDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}