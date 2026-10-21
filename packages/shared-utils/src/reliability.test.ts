import { describe, expect, it } from 'vitest';
import { formatResponseTime, reliabilityFacts, type ReliabilityInput } from './reliability';

const rel = (over: Partial<ReliabilityInput> = {}): ReliabilityInput => ({
  completed_services: 0,
  response_seconds: null,
  on_time_count: 0,
  on_time_total: 0,
  on_time_percent: null,
  ...over,
});

describe('formatResponseTime', () => {
  it('reads naturally from seconds to days', () => {
    expect(formatResponseTime(20)).toBe('menos de 1 min');
    expect(formatResponseTime(720)).toBe('12 min');
    expect(formatResponseTime(3600)).toBe('1 h');
    expect(formatResponseTime(5400)).toBe('1 h 30 min');
    expect(formatResponseTime(86400)).toBe('1 día');
    expect(formatResponseTime(3 * 86400)).toBe('3 días');
  });
});

describe('reliabilityFacts', () => {
  it('says nothing for someone with no history instead of inventing a score', () => {
    expect(reliabilityFacts(rel())).toEqual({
      response: null,
      punctuality: null,
      punctualityTone: 'neutral',
      experience: null,
    });
    expect(reliabilityFacts(undefined).punctuality).toBeNull();
  });

  it('describes response time and experience', () => {
    const f = reliabilityFacts(rel({ completed_services: 1, response_seconds: 720 }));
    expect(f.response).toBe('Sale en ~12 min tras ser elegido');
    expect(f.experience).toBe('1 servicio realizado');
    expect(reliabilityFacts(rel({ completed_services: 4 })).experience).toBe(
      '4 servicios realizados'
    );
  });

  it('shows punctuality, but stays neutral until three services can be judged', () => {
    const few = reliabilityFacts(rel({ on_time_count: 1, on_time_total: 1, on_time_percent: 100 }));
    expect(few.punctuality).toBe('A tiempo en 1 de 1 servicio');
    expect(few.punctualityTone).toBe('neutral');

    const tone = (count: number, total: number) =>
      reliabilityFacts(
        rel({
          on_time_count: count,
          on_time_total: total,
          on_time_percent: Math.round((count / total) * 100),
        })
      ).punctualityTone;
    expect(tone(10, 10)).toBe('good');
    expect(tone(4, 5)).toBe('warn');
    expect(tone(1, 4)).toBe('bad');
  });
});
