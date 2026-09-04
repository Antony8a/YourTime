// Relative Date Utilities
export function getRelativeTimeDescription(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  const secs = Math.floor(absDiffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  const prefix = isFuture ? 'en' : 'hace';
  const suffix = isFuture ? '' : '';

  if (secs < 60) return `${prefix} unos segundos`;
  if (mins < 60) return `${prefix} ${mins} min`;
  if (hours < 24) return `${prefix} ${hours}h`;
  if (days < 7) return `${prefix} ${days}d`;
  if (days < 30) return `${prefix} ${Math.floor(days / 7)} sem`;
  if (days < 365) return `${prefix} ${Math.floor(days / 30)} mes`;

  return isFuture ? 'en más de un año' : 'hace más de un año';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function getTimeAgo(date: Date): string {
  return getRelativeTimeDescription(date);
}