// Truncate
export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

export function truncateWords(text: string, maxWords: number, suffix = '...'): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + suffix;
}

export function truncateMiddle(text: string, maxLength: number, separator = '...'): string {
  if (text.length <= maxLength) return text;
  const half = Math.floor((maxLength - separator.length) / 2);
  return text.slice(0, half) + separator + text.slice(-half);
}