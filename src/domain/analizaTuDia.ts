export interface CalendarDayColor {
  id: string;
  name: string;
  color: string; // CSS color string (hex or rgb)
  value: number; // weight used for monthly weighted average (e.g. 1-6)
  description: string;
}

export interface CalendarDayEntry {
  id?: string;
  date: string; // Format: YYYY-MM-DD
  colorId: string;
  notes: string;
  llmAdvice?: string | null;
  createdAt?: string;
}

export interface LLMSettings {
  apiUrl: string;
  model: string;
  enabled: boolean;
  useMock: boolean;
  notificationTime: string; // Format: HH:MM, e.g. "20:00"
}

export interface MonthlySummary {
  monthKey: string; // Format: YYYY-MM
  averageColorId: string | null;
  colorDistribution: { [colorId: string]: number }; // percentage or count of each color
}

// Default colors defined in the requirement
export const DEFAULT_DIARY_COLORS: CalendarDayColor[] = [
  {
    id: 'muy-bueno',
    name: 'Día MUY bueno',
    color: '#0ea5e9', // AZUL CIAN VIBRANTE
    value: 6,
    description: 'Momentos felices, metas logradas, excelente energía.'
  },
  {
    id: 'bueno',
    name: 'Día bueno',
    color: '#10b981', // VERDE ESMERALDA ALEGRE
    value: 5,
    description: 'Tranquilo, productivo, sensaciones agradables.'
  },
  {
    id: 'sin-mas',
    name: 'Día sin más',
    color: '#f59e0b', // ÁMBAR / AMARILLO CÁLIDO
    value: 4,
    description: 'Ha pasado rápido, rutina habitual, neutro.'
  },
  {
    id: 'aburrido',
    name: 'Día aburrido',
    color: '#94a3b8', // GRIS PIZARRA VIVO
    value: 3,
    description: 'Poca motivación, monotonía, sin actividades emocionantes.'
  },
  {
    id: 'malo',
    name: 'Día malo',
    color: '#f43f5e', // ROSA INTENSO / CARMÍN EMPÁTICO
    value: 2,
    description: 'Estrés, cansancio, contratiempos menores o discusiones.'
  },
  {
    id: 'muy-malo',
    name: 'Día MUY malo',
    color: '#6366f1', // ÍNDIGO VIVO RECONFORTANTE
    value: 1,
    description: 'Sucesos dolorosos, tristeza profunda, malestar severo.'
  }
];
