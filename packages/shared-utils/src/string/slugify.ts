// Slugify
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Collapse multiple -
    .replace(/^-|-$/g, ''); // Trim -
}

export function createSlug(base: string, existing: string[]): string {
  const slug = slugify(base);
  if (!existing.includes(slug)) return slug;

  let counter = 1;
  let newSlug = `${slug}-${counter}`;
  while (existing.includes(newSlug)) {
    counter++;
    newSlug = `${slug}-${counter}`;
  }
  return newSlug;
}