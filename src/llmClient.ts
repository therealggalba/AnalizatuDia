import type { LLMSettings, CalendarDayEntry } from './domain/analizaTuDia';

// Default LLM configuration
export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  apiUrl: 'http://localhost:11434',
  model: 'qwen2:0.5b', // Changed default to Qwen2 0.5B for fast local CPU inference
  enabled: true,       // Enabled by default since we provide local Ollama setup now
  useMock: false,      // Disabled mock by default to try real local LLM
  notificationTime: '20:30'
};

// Local storage key for settings
const SETTINGS_KEY = 'analizatudia_llm_settings';

export function getLLMSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_LLM_SETTINGS, ...JSON.parse(raw) } : DEFAULT_LLM_SETTINGS;
  } catch (e) {
    return DEFAULT_LLM_SETTINGS;
  }
}

export function saveLLMSettings(settings: LLMSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving LLM settings', e);
  }
}

// Empathic local mock generator to guarantee 100% functionality offline and sensitive tone
function generateMockAdvice(colorId: string, notes: string, history: CalendarDayEntry[] = []): string {
  const noteLower = notes.toLowerCase();
  
  // Detect sensitive keywords for custom responses
  const isLoss = noteLower.includes('muerte') || noteLower.includes('falleció') || noteLower.includes('pérdida') || noteLower.includes('perro') || noteLower.includes('gato') || noteLower.includes('mascota') || noteLower.includes('tristeza');
  const isHealth = noteLower.includes('enfermo') || noteLower.includes('médico') || noteLower.includes('dolor') || noteLower.includes('hospital') || noteLower.includes('gripe') || noteLower.includes('fiebre');
  const isWorkStress = noteLower.includes('jefe') || noteLower.includes('trabajo') || noteLower.includes('estrés') || noteLower.includes('despido') || noteLower.includes('examen') || noteLower.includes('estudiar');
  const isRelationship = noteLower.includes('discusión') || noteLower.includes('pelea') || noteLower.includes('novi') || noteLower.includes('pareja') || noteLower.includes('amigo');

  // Analyze history (excluding today's date if it is in history)
  const pastEntries = history.slice(0, 7);
  const badDaysCount = pastEntries.filter(e => ['malo', 'muy-malo', 'aburrido'].includes(e.colorId)).length;
  const goodDaysCount = pastEntries.filter(e => ['muy-bueno', 'bueno'].includes(e.colorId)).length;

  let trendPrefix = '';
  if (pastEntries.length >= 2) {
    if (badDaysCount >= 3) {
      if (['muy-bueno', 'bueno'].includes(colorId)) {
        trendPrefix = "Qué alegría ver que hoy se ha roto la racha de días difíciles que llevabas. ";
      } else {
        trendPrefix = "Veo que está siendo una racha bastante complicada últimamente. ";
      }
    } else if (goodDaysCount >= 3) {
      if (['muy-malo', 'malo'].includes(colorId)) {
        trendPrefix = "Lamento este bache de hoy tras varios días bastante buenos. ";
      } else {
        trendPrefix = "Qué bien que sigas manteniendo la buena estabilidad de tus últimos días. ";
      }
    }
  }

  switch (colorId) {
    case 'muy-bueno':
      if (notes.trim() === '') {
        return `${trendPrefix}¡Hoy ha sido un día fantástico! Tómate un momento para saborear esta gran energía y recuerda qué lo hizo tan especial para cuando necesites un empujón. ¡Sigue brillando!`;
      }
      return `${trendPrefix}¡Me alegra muchísimo leer que has tenido un día tan maravilloso! Es estupendo que "${notes.substring(0, 60)}${notes.length > 60 ? '...' : ''}" haya salido tan bien. Guarda este recuerdo en tu corazón, ¡te has ganado cada momento de esta felicidad!`;

    case 'bueno':
      return `${trendPrefix}Qué buena noticia. Los días buenos construyen una vida armoniosa. Agradece la tranquilidad, la productividad o esos pequeños momentos de bienestar que has vivido hoy. ¡Que esa buena inercia te acompañe mañana!`;

    case 'sin-mas':
      if (isWorkStress) {
        return `${trendPrefix}Un día de rutina laboral superado. Está bien que haya sido neutro; a veces la calma y no tener sobresaltos en el trabajo es una victoria silenciosa. Esta noche, intenta desconectar por completo de las obligaciones.`;
      }
      return `${trendPrefix}Un día equilibrado. Ni muy alto ni muy bajo. Los días 'sin más' nos dan estabilidad y nos permiten descansar de las emociones intensas. Si buscas algo diferente para mañana, tal vez puedas probar una pequeña novedad como leer un capítulo de un libro nuevo o dar un paseo por una ruta distinta.`;

    case 'aburrido':
      return `${trendPrefix}El aburrimiento puede ser el espacio perfecto para la creatividad o simplemente para recargar pilas. Si mañana quieres romper la rutina, te sugiero planificar algo pequeño que te ilusione: escuchar tu disco favorito, llamar a alguien con quien hace tiempo no hablas o dar una caminata al aire libre.`;

    case 'malo':
      let maloResponse = `${trendPrefix}Siento que hoy no haya sido un buen día. El estrés y los obstáculos forman parte del camino, pero no definen tu semana. `;
      if (isWorkStress) {
        maloResponse += "El trabajo a veces nos exige más de la cuenta y nos agota. Intenta dejar las preocupaciones laborales en la puerta de entrada esta noche; tu tiempo libre te pertenece y te mereces desconectar y descansar.";
      } else if (isHealth) {
        maloResponse += "Sentirse mal físicamente altera nuestro estado de ánimo por completo. Prioriza tu descanso, prepárate una infusión o una comida reconfortante y dale tiempo al cuerpo para recuperarse.";
      } else if (isRelationship) {
        maloResponse += "Los malentendidos con personas cercanas duelen y desgastan. Esta noche, intenta respirar hondo, darte un espacio de calma y no tomar decisiones ni sacar conclusiones apresuradas. El descanso suele suavizar las tensiones.";
      } else {
        maloResponse += "Esta noche, procura ser muy amable contigo mismo/a. Prepárate algo caliente, descansa y recuerda que mañana es una nueva oportunidad para empezar de cero con la mente despejada. ¡Mucho ánimo!";
      }
      return maloResponse;

    case 'muy-malo':
      if (isLoss) {
        return "Lamento profundamente tu pérdida y el dolor que estás sintiendo hoy. En momentos así, las palabras a veces se quedan cortas. Por favor, sé extremadamente paciente contigo mismo/a. Tienes derecho a estar triste y a no sentirte bien. No te exijas nada hoy, solo respira, descansa y apóyate en quienes te quieren. Un abrazo muy fuerte y respetuoso.";
      }
      if (isHealth) {
        return "Lamento mucho que te sientas tan mal de salud. El cuerpo nos pide parar y cuidarnos. Olvídate de los pendientes and prioriza tu recuperación al 100%. Descansa todo lo que puedas, mantente hidratado/a y sé muy paciente. Tu bienestar es lo primero.";
      }
      if (isRelationship) {
        return "Lamento que hayas tenido un conflicto tan doloroso hoy. Las relaciones humanas a veces nos desgastan profundamente. Intenta no darles demasiadas vueltas a las cosas esta noche con la cabeza cansada; con el descanso y la distancia, las soluciones y la calma se ven más claras. Te deseo una noche de paz.";
      }
      return `${trendPrefix}Lamento en el alma que hoy haya sido un día tan duro. Hay jornadas que se sienten como una tormenta. Por favor, no te presiones para buscar el lado positivo ahora mismo. Tienes derecho a descansar, a desconectar y a dejar que el día pase. Cuídate mucho, haz algo que te reconforte físicamente y recuerda que el dolor de hoy también pasará. Estoy contigo.`;

    default:
      return "Gracias por registrar tu día. Escucharte a ti mismo y registrar cómo te sientes es el primer paso para cuidar tu bienestar emocional.";
  }
}

export async function generateLLMAdvice(
  colorId: string,
  notes: string,
  history: CalendarDayEntry[],
  settings: LLMSettings
): Promise<string> {
  // If LLM is disabled or set to mock, generate the local mock response immediately
  if (!settings.enabled || settings.useMock) {
    // Artificial small delay to make it feel natural (simulate processing)
    await new Promise(resolve => setTimeout(resolve, 800));
    return generateMockAdvice(colorId, notes, history);
  }

  const colorMap: Record<string, string> = {
    'muy-bueno': 'MUY bueno (Azul)',
    'bueno': 'Bueno (Verde)',
    'sin-mas': 'Sin más / Neutro (Amarillo)',
    'aburrido': 'Aburrido (Gris)',
    'malo': 'Malo (Rojo)',
    'muy-malo': 'MUY malo (Negro)'
  };

  const colorText = colorMap[colorId] || colorId;

  // Render past history to text for prompt context
  // Sort history by date descending and take top 7
  const sortedHistory = [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const historyText = sortedHistory.length > 0
    ? sortedHistory.map(h => `- Día ${h.date}: Calificación [${colorMap[h.colorId] || h.colorId}]. Notas: "${h.notes || 'Sin notas'}"`).join('\n')
    : 'No hay histórico registrado de días anteriores.';

  // Prompt looking for stabilization, mood evolution, respect, and EOD advice
  const prompt = `Actúa como un psicólogo y coach de bienestar empático, cordial y muy respetuoso.
El objetivo es analizar el día actual del usuario y la evolución reciente de su estado de ánimo para sugerir pautas que ayuden a estabilizar su bienestar y guiarle a días felices.

Día de hoy:
- Calificación: ${colorText}
- Notas de hoy: "${notes}"

Evolución de los últimos días registrados:
${historyText}

Instrucciones para redactar tu respuesta:
1. Sé muy breve (máximo 4 frases).
2. Analiza el día actual teniendo en cuenta la inercia del histórico (si viene de una racha difícil, si hoy es un bache aislado en una racha buena, o si mantiene estabilidad).
3. Ofrece un consejo cordial de bienestar nocturno, autocuidado o plan motivacional diseñado para estabilizar su felicidad.
4. Si el día es malo o muy malo y la nota menciona problemas de salud, duelos o conflictos interpersonales, sé extremadamente respetuoso y delicado.
5. No utilices introducciones ("Como psicólogo...", "Aquí tienes tu consejo...") ni tecnicismos. Escribe la sugerencia de forma directa y cercana en español.`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout for local LLM

    const response = await fetch(`${settings.apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || data.choices?.[0]?.message?.content || generateMockAdvice(colorId, notes, history);
  } catch (error) {
    console.warn('Ollama/LLM call failed or timed out. Falling back to local mock advice. Error:', error);
    // Silent fallback to mock
    return generateMockAdvice(colorId, notes, history);
  }
}
