import { supabase } from './supabaseClient';
import type { CalendarDayEntry } from './domain/analizaTuDia';

const LOCAL_STORAGE_KEY = 'analizatudia_entries';

// Helper to get all from localStorage
function getLocalEntries(): CalendarDayEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading from localStorage', e);
    return [];
  }
}

// Helper to save to localStorage
function saveLocalEntries(entries: CalendarDayEntry[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

export const dbService = {
  /**
   * Fetch all diary entries.
   * If supabase is available, it fetches from supabase. If it fails, falls back to localStorage.
   */
  async getEntries(): Promise<CalendarDayEntry[]> {
    if (!supabase) {
      return getLocalEntries();
    }

    try {
      const { data, error } = await supabase
        .from('analiza_tu_dia_entries')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        // Table might not exist yet or there's a permission error, fall back to local
        console.warn('Supabase fetch failed, falling back to localStorage:', error.message);
        return getLocalEntries();
      }

      // Convert supabase snake_case keys back to camelCase
      const formatted: CalendarDayEntry[] = (data || []).map(item => ({
        id: item.id,
        date: item.date,
        colorId: item.color_id,
        notes: item.notes,
        llmAdvice: item.llm_advice,
        createdAt: item.created_at
      }));

      // Keep localStorage in sync in case we go offline later
      saveLocalEntries(formatted);
      return formatted;
    } catch (e) {
      console.error('Database connection error, falling back to localStorage:', e);
      return getLocalEntries();
    }
  },

  /**
   * Save or update a diary entry.
   */
  async saveEntry(entry: Omit<CalendarDayEntry, 'id' | 'createdAt'>): Promise<CalendarDayEntry> {
    // 1. Always update local storage first so we don't lose data
    const local = getLocalEntries();
    const existingIndex = local.findIndex(e => e.date === entry.date);
    
    let updatedEntry: CalendarDayEntry = { ...entry };
    
    if (existingIndex >= 0) {
      updatedEntry = { ...local[existingIndex], ...entry };
      local[existingIndex] = updatedEntry;
    } else {
      updatedEntry.id = crypto.randomUUID();
      updatedEntry.createdAt = new Date().toISOString();
      local.push(updatedEntry);
    }
    saveLocalEntries(local);

    // 2. Try to sync to Supabase if client is available
    if (supabase) {
      try {
        const dbPayload = {
          date: entry.date,
          color_id: entry.colorId,
          notes: entry.notes,
          llm_advice: entry.llmAdvice
        };

        // Check if row already exists in database
        const { data: existing, error: checkError } = await supabase
          .from('analiza_tu_dia_entries')
          .select('id')
          .eq('date', entry.date)
          .maybeSingle();

        if (checkError) throw checkError;

        let result;
        if (existing) {
          result = await supabase
            .from('analiza_tu_dia_entries')
            .update(dbPayload)
            .eq('date', entry.date)
            .select();
        } else {
          result = await supabase
            .from('analiza_tu_dia_entries')
            .insert([{ ...dbPayload, id: updatedEntry.id }])
            .select();
        }

        if (result.error) {
          console.warn('Could not sync to Supabase, saved locally:', result.error.message);
        } else if (result.data && result.data.length > 0) {
          const synced = result.data[0];
          updatedEntry = {
            id: synced.id,
            date: synced.date,
            colorId: synced.color_id,
            notes: synced.notes,
            llmAdvice: synced.llm_advice,
            createdAt: synced.created_at
          };
          
          // Re-update local storage with actual server data (e.g. server-side timestamps)
          const latestLocal = getLocalEntries();
          const idx = latestLocal.findIndex(e => e.date === entry.date);
          if (idx >= 0) {
            latestLocal[idx] = updatedEntry;
            saveLocalEntries(latestLocal);
          }
        }
      } catch (e) {
        console.error('Supabase sync error, saved locally:', e);
      }
    }

    return updatedEntry;
  },

  /**
   * DDL Script representation for user convenience.
   */
  getDDL(): string {
    return `
-- Tabla para registrar las emociones de cada día
CREATE TABLE IF NOT EXISTS public.analiza_tu_dia_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT UNIQUE NOT NULL, -- Formato YYYY-MM-DD
    color_id TEXT NOT NULL,
    notes TEXT,
    llm_advice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas de seguridad básicas de Supabase RLS (Row Level Security)
ALTER TABLE public.analiza_tu_dia_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso público y anónimo para desarrollo"
ON public.analiza_tu_dia_entries
FOR ALL
USING (true)
WITH CHECK (true);
`;
  }
};
