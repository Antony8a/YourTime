// Email Validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string): string | null {
  const atIndex = email.lastIndexOf('@');
  return atIndex > 0 ? email.slice(atIndex + 1) : null;
}