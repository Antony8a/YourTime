import type { ApplicationStatus, BudgetType, TaskStatus } from '@yourtime/shared-types';
import type { BadgeTone } from '@/components/ui';

/** User-facing Spanish copy for backend vocabulary, in one place. */

export const taskStatusLabel: Record<TaskStatus, string> = {
  open: 'Abierta',
  assigned: 'Asignada',
  en_route: 'En camino',
  in_progress: 'En servicio',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

export const taskStatusTone: Record<TaskStatus, BadgeTone> = {
  open: 'success',
  assigned: 'info',
  en_route: 'info',
  in_progress: 'primary',
  completed: 'neutral',
  cancelled: 'danger',
};

export const applicationStatusLabel: Record<ApplicationStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'No seleccionada',
  withdrawn: 'Retirada',
};

export const applicationStatusTone: Record<ApplicationStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'neutral',
  withdrawn: 'neutral',
};

export const budgetTypeLabel: Record<BudgetType, string> = {
  fixed: 'Precio fijo',
  hourly: 'Por hora',
  negotiable: 'A convenir',
};

/** Guesses a sensible default currency from the device region. */
const REGION_CURRENCY: Record<string, string> = {
  CO: 'COP',
  MX: 'MXN',
  AR: 'ARS',
  CL: 'CLP',
  PE: 'PEN',
  UY: 'UYU',
  BO: 'BOB',
  PY: 'PYG',
  VE: 'VES',
  DO: 'DOP',
  CR: 'CRC',
  GT: 'GTQ',
  HN: 'HNL',
  NI: 'NIO',
  PA: 'PAB',
  BR: 'BRL',
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  ES: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
};

export function guessCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split('-').pop()?.toUpperCase() ?? '';
    return REGION_CURRENCY[region] ?? 'USD';
  } catch {
    return 'USD';
  }
}
