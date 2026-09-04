// Mask
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local[0] || '';
  const masked = '*'.repeat(Math.max(0, local.length - visible.length));
  return `${visible}${masked}@${domain}`;
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  const visible = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);
  return masked + visible;
}

export function maskCreditCard(card: string): string {
  const cleaned = card.replace(/\D/g, '');
  if (cleaned.length < 4) return card;
  const visible = cleaned.slice(-4);
  const masked = '*'.repeat(cleaned.length - 4);
  return masked + visible;
}

export function maskString(text: string, visibleStart = 2, visibleEnd = 2): string {
  if (text.length <= visibleStart + visibleEnd) return text;
  const start = text.slice(0, visibleStart);
  const end = text.slice(-visibleEnd);
  const masked = '*'.repeat(text.length - visibleStart - visibleEnd);
  return start + masked + end;
}