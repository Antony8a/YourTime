/** The shape of the API's reliability summary; shared-types' `Reliability` satisfies it. */
export interface ReliabilityInput {
  completed_services: number;
  response_seconds: number | null;
  on_time_count: number;
  on_time_total: number;
  on_time_percent: number | null;
}

/** "menos de 1 min", "12 min", "1 h 30 min", "3 h", "2 días". */
export function formatResponseTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.round(minutes / 1440);
  return days === 1 ? '1 día' : `${days} días`;
}

export type ReliabilityTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface ReliabilityFacts {
  /** "Sale en ~12 min tras ser elegido", or null with no history. */
  response: string | null;
  /** "A tiempo en 4 de 5 servicios", or null when nothing could be judged. */
  punctuality: string | null;
  /** How to colour the punctuality. Neutral until there are enough services to say. */
  punctualityTone: ReliabilityTone;
  /** "3 servicios realizados", or null with none. */
  experience: string | null;
}

/** Judging punctuality from fewer services than this would be unfair, so it stays neutral. */
const MIN_FOR_TONE = 3;

export function reliabilityFacts(r: ReliabilityInput | undefined): ReliabilityFacts {
  if (!r)
    return { response: null, punctuality: null, punctualityTone: 'neutral', experience: null };
  const percent = r.on_time_percent;
  let tone: ReliabilityTone = 'neutral';
  if (percent != null && r.on_time_total >= MIN_FOR_TONE) {
    tone = percent >= 90 ? 'good' : percent >= 70 ? 'warn' : 'bad';
  }
  return {
    response:
      r.response_seconds != null
        ? `Sale en ~${formatResponseTime(r.response_seconds)} tras ser elegido`
        : null,
    punctuality:
      r.on_time_total > 0
        ? `A tiempo en ${r.on_time_count} de ${r.on_time_total} ${r.on_time_total === 1 ? 'servicio' : 'servicios'}`
        : null,
    punctualityTone: tone,
    experience:
      r.completed_services > 0
        ? `${r.completed_services} ${r.completed_services === 1 ? 'servicio realizado' : 'servicios realizados'}`
        : null,
  };
}
