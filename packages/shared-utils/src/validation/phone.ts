// Phone Validation
export function isValidPhone(phone: string): boolean {
  // E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

export function normalizePhone(phone: string): string {
  // Remove all non-digits except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

export function formatPhoneForDisplay(phone: string): string {
  // Format: +54 9 11 2345-6789
  const cleaned = normalizePhone(phone);
  if (cleaned.length < 3) return phone;
  
  const countryCode = cleaned.slice(0, 3); // +54
  const rest = cleaned.slice(3);
  
  if (rest.length === 10) {
    // Argentina mobile: +54 9 11 2345-6789
    return `${countryCode} ${rest.slice(0, 1)} ${rest.slice(1, 3)} ${rest.slice(3, 7)}-${rest.slice(7)}`;
  }
  
  return cleaned;
}

export function getPhoneCountryCode(phone: string): string | null {
  const normalized = normalizePhone(phone);
  const match = normalized.match(/^\+(\d{1,3})/);
  return match ? match[1] : null;
}