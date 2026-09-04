// Password Validation
export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Mínimo 8 caracteres');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Debe contener minúsculas');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Debe contener mayúsculas');

  if (/\d/.test(password)) score++;
  else feedback.push('Debe contener números');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Debe contener símbolos');

  return {
    score: Math.min(score, 4),
    feedback,
    isValid: score >= 3 && password.length >= 8,
  };
}

export function getPasswordStrengthLabel(score: number): string {
  const labels = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte'];
  return labels[score] || 'Desconocido';
}