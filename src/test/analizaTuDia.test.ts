import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_DIARY_COLORS } from '../domain/analizaTuDia';
import type { CalendarDayEntry, CalendarDayColor } from '../domain/analizaTuDia';
import { generateLLMAdvice } from '../llmClient';

// Test of monthly average calculation logic
function calculateWeightedAverageColor(
  monthEntries: CalendarDayEntry[],
  colors: CalendarDayColor[]
): CalendarDayColor | null {
  if (monthEntries.length === 0) return null;

  let totalWeight = 0;
  let validCount = 0;

  monthEntries.forEach(entry => {
    const colorDef = colors.find(c => c.id === entry.colorId);
    if (colorDef) {
      totalWeight += colorDef.value;
      validCount += 1;
    }
  });

  if (validCount === 0) return null;

  const avg = totalWeight / validCount;
  
  let closestColor = colors[0];
  let minDifference = Math.abs(closestColor.value - avg);

  colors.forEach(c => {
    const diff = Math.abs(c.value - avg);
    if (diff < minDifference) {
      minDifference = diff;
      closestColor = c;
    }
  });

  return closestColor;
}

describe('AnalizaTuDia logic tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Weighted average mood calculation', () => {
    it('should return null when there are no entries', () => {
      const avg = calculateWeightedAverageColor([], DEFAULT_DIARY_COLORS);
      expect(avg).toBeNull();
    });

    it('should return exact match color when all days are same mood', () => {
      const entries: CalendarDayEntry[] = [
        { date: '2026-07-01', colorId: 'muy-bueno', notes: '' },
        { date: '2026-07-02', colorId: 'muy-bueno', notes: '' },
        { date: '2026-07-03', colorId: 'muy-bueno', notes: '' }
      ];
      const avg = calculateWeightedAverageColor(entries, DEFAULT_DIARY_COLORS);
      expect(avg).toBeDefined();
      expect(avg?.id).toBe('muy-bueno');
    });

    it('should calculate correct average between Muy Bueno (6) and Muy Malo (1)', () => {
      // (6 + 1) / 2 = 3.5.
      // 3.5 is closest to Aburrido (3) or Sin Más (4). DEFAULT_DIARY_COLORS has 'aburrido' as 3, 'sin-mas' as 4.
      // The first closest will be picked. Let's verify it matches either 3 or 4.
      const entries: CalendarDayEntry[] = [
        { date: '2026-07-01', colorId: 'muy-bueno', notes: '' },
        { date: '2026-07-02', colorId: 'muy-malo', notes: '' }
      ];
      const avg = calculateWeightedAverageColor(entries, DEFAULT_DIARY_COLORS);
      expect(avg).toBeDefined();
      expect(['aburrido', 'sin-mas']).toContain(avg?.id);
    });

    it('should approximate correctly to "bueno" for values close to 5', () => {
      // (6 + 5 + 4) / 3 = 5 (bueno)
      const entries: CalendarDayEntry[] = [
        { date: '2026-07-01', colorId: 'muy-bueno', notes: '' },
        { date: '2026-07-02', colorId: 'bueno', notes: '' },
        { date: '2026-07-03', colorId: 'sin-mas', notes: '' }
      ];
      const avg = calculateWeightedAverageColor(entries, DEFAULT_DIARY_COLORS);
      expect(avg).toBeDefined();
      expect(avg?.id).toBe('bueno');
    });
  });

  describe('Empathic local mock LLM advisor', () => {
    it('should generate optimistic response for a very good day', async () => {
      const advice = await generateLLMAdvice('muy-bueno', 'He aprobado mi examen de conducir a la primera', [], {
        apiUrl: '',
        model: '',
        enabled: false, // forces mock fallback
        useMock: true,
        notificationTime: '20:00'
      });
      expect(advice).toContain('maravilloso');
      expect(advice).toContain('examen de conducir');
    });

    it('should generate respectful and sensitive response for a loss in a very bad day', async () => {
      const advice = await generateLLMAdvice('muy-malo', 'Hoy falleció mi gato', [], {
        apiUrl: '',
        model: '',
        enabled: false,
        useMock: true,
        notificationTime: '20:00'
      });
      expect(advice).toContain('Lamento profundamente tu pérdida');
      expect(advice).toContain('paciente contigo');
    });

    it('should generate stress support response for work problems', async () => {
      const advice = await generateLLMAdvice('malo', 'El jefe ha estado insoportable con los plazos', [], {
        apiUrl: '',
        model: '',
        enabled: false,
        useMock: true,
        notificationTime: '20:00'
      });
      expect(advice).toContain('trabajo');
      expect(advice).toContain('desconectar');
    });
  });
});
