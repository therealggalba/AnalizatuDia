import React, { useEffect, useState } from 'react';
import { dbService } from './dbService';
import { generateLLMAdvice, getLLMSettings, saveLLMSettings } from './llmClient';
import { DEFAULT_DIARY_COLORS } from './domain/analizaTuDia';
import type { CalendarDayEntry, CalendarDayColor, LLMSettings } from './domain/analizaTuDia';
import { 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  ArrowLeft, 
  Save, 
  Sparkles, 
  X, 
  Bell,
  Trash2,
  Plus
} from 'lucide-react';
import styles from './App.module.scss';

// Local storage key for custom colors
const COLORS_STORAGE_KEY = 'analizatudia_custom_colors';

export const App: React.FC = () => {
  const galbaHubUrl = import.meta.env.DEV ? 'http://localhost:5173' : 'https://galbahub.com';

  // State
  const [entries, setEntries] = useState<CalendarDayEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Date selection (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedColorId, setSelectedColorId] = useState<string>('');
  const [selectedNotes, setSelectedNotes] = useState<string>('');
  const [savedAdvice, setSavedAdvice] = useState<string | null>(null);

  // Calendar navigation state
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-11

  // Settings states
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settings, setSettings] = useState<LLMSettings>(getLLMSettings);
  const [customColors, setCustomColors] = useState<CalendarDayColor[]>(() => {
    try {
      const raw = localStorage.getItem(COLORS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_DIARY_COLORS;
    } catch {
      return DEFAULT_DIARY_COLORS;
    }
  });

  // Color creator states
  const [newColorHex, setNewColorHex] = useState<string>('#3b82f6');
  const [newColorName, setNewColorName] = useState<string>('');
  const [newColorValue, setNewColorValue] = useState<number>(3); // Weight scale 1-6

  // Proactive notification toast state
  const [proactiveToast, setProactiveToast] = useState<{
    visible: boolean;
    advice: string;
    date: string;
  } | null>(null);

  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState<boolean>(false);

  // Load all entries on startup
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await dbService.getEntries();
        setEntries(data);
      } catch (err) {
        console.error('Error loading diary entries:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    requestNotificationPermission();
  }, []);

  // Request browser notification permissions for premium push-up experience
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // Sync inputs with selected date
  useEffect(() => {
    const activeEntry = entries.find(e => e.date === selectedDate);
    if (activeEntry) {
      setSelectedColorId(activeEntry.colorId);
      setSelectedNotes(activeEntry.notes);
      setSavedAdvice(activeEntry.llmAdvice || null);
    } else {
      setSelectedColorId('');
      setSelectedNotes('');
      setSavedAdvice(null);
    }
  }, [selectedDate, entries]);

  // Proactive end-of-day notification check
  useEffect(() => {
    if (loading || entries.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find(e => e.date === todayStr);

    if (todayEntry && todayEntry.notes && todayEntry.llmAdvice) {
      const [notifHour, notifMin] = settings.notificationTime.split(':').map(Number);
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      // If current time is past the scheduled notification time
      if (currentHour > notifHour || (currentHour === notifHour && currentMin >= notifMin)) {
        // Only trigger toast once per page load/session for that day
        const sessionShown = sessionStorage.getItem(`shown_notif_${todayStr}`);
        if (!sessionShown) {
          triggerNotification(todayEntry.llmAdvice, todayStr);
        }
      }
    }
  }, [entries, loading, settings.notificationTime]);

  const triggerNotification = (advice: string, date: string) => {
    setProactiveToast({
      visible: true,
      advice,
      date
    });
    sessionStorage.setItem(`shown_notif_${date}`, 'true');

    // System Notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Analiza Tu Día', {
        body: advice,
        icon: '/favicon.svg'
      });
    }
  };

  // Extract past entries history (excluding selected day) for LLM context
  const getEmotionalHistory = (targetDate: string): CalendarDayEntry[] => {
    return entries
      .filter(e => e.date !== targetDate && e.date < targetDate)
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending (most recent first)
  };

  // Handle diary save
  const handleSave = async () => {
    if (!selectedColorId) return;

    try {
      setIsGeneratingAdvice(true);
      
      // 1. Quick save to local / Supabase (no advice yet)
      const preSave = await dbService.saveEntry({
        date: selectedDate,
        colorId: selectedColorId,
        notes: selectedNotes,
        llmAdvice: savedAdvice // Keep previous advice for a brief moment
      });

      setEntries(prev => {
        const idx = prev.findIndex(e => e.date === selectedDate);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = preSave;
          return next;
        }
        return [...prev, preSave];
      });

      // 2. Fetch last 7 days history for context analysis
      const history = getEmotionalHistory(selectedDate);

      // 3. Generate background advice analyzing evolution
      const advice = await generateLLMAdvice(selectedColorId, selectedNotes, history, settings);
      
      // 4. Save entry with generated advice
      const postSave = await dbService.saveEntry({
        date: selectedDate,
        colorId: selectedColorId,
        notes: selectedNotes,
        llmAdvice: advice
      });

      setEntries(prev => {
        const idx = prev.findIndex(e => e.date === selectedDate);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = postSave;
          return next;
        }
        return [...prev, postSave];
      });

      setSavedAdvice(advice);

      // Proactive trigger check (if date is today, show popup toast in 2.5 seconds to feel automatic)
      const todayStr = new Date().toISOString().split('T')[0];
      if (selectedDate === todayStr) {
        setTimeout(() => {
          triggerNotification(advice, selectedDate);
        }, 2500);
      }

    } catch (err) {
      console.error('Error saving diary entry:', err);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  // Save App Settings
  const handleSaveSettings = () => {
    saveLLMSettings(settings);
    setShowSettings(false);
  };

  // Color customization helpers
  const handleAddColor = () => {
    if (!newColorName.trim()) return;

    const id = newColorName.toLowerCase().replace(/\s+/g, '-');
    if (customColors.some(c => c.id === id)) {
      alert('Ya existe una categoría con ese nombre.');
      return;
    }

    const newColor: CalendarDayColor = {
      id,
      name: newColorName,
      color: newColorHex,
      value: newColorValue,
      description: `Categoría personalizada: ${newColorName}`
    };

    const nextColors = [...customColors, newColor];
    setCustomColors(nextColors);
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(nextColors));

    setNewColorName('');
  };

  const handleDeleteColor = (id: string) => {
    if (customColors.length <= 1) {
      alert('Debe quedar al menos una categoría de color para poder completar el día.');
      return;
    }

    const nextColors = customColors.filter(c => c.id !== id);
    setCustomColors(nextColors);
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(nextColors));

    // Limpiar selección de color si era el que se acaba de eliminar
    if (selectedColorId === id) {
      setSelectedColorId('');
    }
  };

  const handleRenameColor = (id: string, newName: string) => {
    const nextColors = customColors.map(c => {
      if (c.id === id) {
        return { ...c, name: newName };
      }
      return c;
    });
    setCustomColors(nextColors);
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(nextColors));
  };

  const handleRecolorColor = (id: string, newHex: string) => {
    const nextColors = customColors.map(c => {
      if (c.id === id) {
        return { ...c, color: newHex };
      }
      return c;
    });
    setCustomColors(nextColors);
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(nextColors));
  };

  // Month navigation helpers
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  // Calendar parameters
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday starts at 0, Sunday at 6
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  // Filter entries for the current month
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter(e => e.date.startsWith(currentMonthKey));

  // Compute monthly weighted average mood (Zero numbers displayed)
  const getMonthlyWeightedAverage = () => {
    if (monthEntries.length === 0) return null;

    let totalWeight = 0;
    let validCount = 0;

    monthEntries.forEach(entry => {
      const colorDef = customColors.find(c => c.id === entry.colorId);
      if (colorDef) {
        totalWeight += colorDef.value;
        validCount += 1;
      }
    });

    if (validCount === 0) return null;

    const avg = totalWeight / validCount;
    let closestColor = customColors[0];
    let minDifference = Math.abs(closestColor.value - avg);

    customColors.forEach(c => {
      const diff = Math.abs(c.value - avg);
      if (diff < minDifference) {
        minDifference = diff;
        closestColor = c;
      }
    });

    return closestColor;
  };

  const monthlyAverageColor = getMonthlyWeightedAverage();

  // Check if current month is fully completed (today is on/after last day of that month)
  const isMonthCompleted = () => {
    const today = new Date();
    const currentYearSystem = today.getFullYear();
    const currentMonthSystem = today.getMonth();

    if (currentYear < currentYearSystem) return true;
    if (currentYear === currentYearSystem && currentMonth < currentMonthSystem) return true;
    
    if (currentYear === currentYearSystem && currentMonth === currentMonthSystem) {
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      return today.getDate() >= lastDay;
    }
    return false;
  };

  const showMonthlyAverage = isMonthCompleted() && monthlyAverageColor !== null;

  // Calendar cells render helper
  const renderCells = () => {
    const cells = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Padding empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className={styles.cellEmpty} />);
    }

    // Days cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = entries.find(e => e.date === dateStr);
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === todayStr;

      let cellClass = styles.cellDay;
      if (isSelected) cellClass += ` ${styles.selected}`;
      if (entry) cellClass += ` ${styles[`mood_${entry.colorId}`] || ''}`;

      cells.push(
        <div 
          key={dateStr} 
          className={cellClass} 
          onClick={() => setSelectedDate(dateStr)}
        >
          <span className={styles.dayNumber}>{day}</span>
          {isToday && <span className={styles.todayIndicator} />}
        </div>
      );
    }

    return cells;
  };

  if (loading) {
    return (
      <div className={styles.appContainer}>
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p>Cargando tu calendario de emociones...</p>
        </div>
      </div>
    );
  }

  const selectedDateObject = new Date(selectedDate);
  const formattedSelectedDate = selectedDateObject.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={styles.appContainer}>
      
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <a href={galbaHubUrl} className={styles.backBtn}>
            <ArrowLeft size={16} />
            <span>Volver a GalbaHub</span>
          </a>
          <h1 className={styles.title}>AnalizaTuDía</h1>
        </div>
        <button 
          className={`${styles.settingsBtn} ${showSettings ? styles.active : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Ajustes de LLM y Colores"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Main Grid Workspace */}
      <main className={styles.workspace}>
        
        {/* Left Side: Calendar Grid */}
        <section className={styles.calendarPanel}>
          <div className={styles.calendarHeader}>
            <div className={styles.monthSelector}>
              <button className={styles.navBtn} onClick={prevMonth}>
                <ChevronLeft size={20} />
              </button>
              <h2>{monthNames[currentMonth]} {currentYear}</h2>
              <button className={styles.navBtn} onClick={nextMonth}>
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Ultra-minimal Monthly Summary Circle (No texts, no cards, just color at EOM) */}
            {showMonthlyAverage && (
              <div className={styles.monthlySummaryWrapper}>
                <span className={styles.summaryLabel}>Mes:</span>
                <div 
                  className={styles.moodCircle} 
                  style={{ 
                    backgroundColor: monthlyAverageColor.color,
                    boxShadow: `0 0 12px ${monthlyAverageColor.color}`
                  }}
                  title={`Resumen del mes: ${monthlyAverageColor.name}`}
                />
              </div>
            )}
          </div>

          <div className={styles.weekdays}>
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          <div className={styles.grid}>
            {renderCells()}
          </div>
        </section>

        {/* Right Side: Details Form */}
        <section className={styles.detailPanel}>
          <div className={styles.panelHeader}>
            <h3>Registro de Jornada</h3>
            <span className={styles.dateLabel}>{formattedSelectedDate}</span>
          </div>

          <div>
            <span className={styles.label}>¿Cómo ha ido tu día?</span>
            <div className={styles.moodSelectors}>
              {customColors.map(colorDef => (
                <button
                  key={colorDef.id}
                  className={`${styles.moodBtn} ${styles[colorDef.id]} ${selectedColorId === colorDef.id ? styles.selected : ''}`}
                  onClick={() => setSelectedColorId(colorDef.id)}
                  title={colorDef.description}
                >
                  <span className={styles.dot} />
                  <span className={styles.name}>{colorDef.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <span className={styles.label}>Notas personales</span>
            <textarea
              className={styles.noteArea}
              placeholder="Escribe lo que ha sucedido hoy... (momentos clave, sensaciones, motivos)"
              value={selectedNotes}
              onChange={e => setSelectedNotes(e.target.value)}
            />
          </div>

          <button 
            className={styles.saveBtn} 
            onClick={handleSave}
            disabled={!selectedColorId || isGeneratingAdvice}
          >
            <Save size={18} />
            <span>{isGeneratingAdvice ? 'Procesando con LLM...' : 'Guardar Día'}</span>
          </button>
        </section>

        {/* Settings Overlay (Absolute positioned panel, does not shift layout) */}
        {showSettings && (
          <section className={styles.settingsPanel}>
            <div className={styles.settingsHeader}>
              <h3>Ajustes de la Aplicación</h3>
              <button 
                className={styles.closeSettingsBtn}
                onClick={() => setShowSettings(false)}
                title="Cerrar Ajustes"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Hora del aviso nocturno */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Hora del aviso nocturno</label>
              <input 
                type="time" 
                className={styles.input} 
                value={settings.notificationTime} 
                onChange={e => setSettings({ ...settings, notificationTime: e.target.value })}
              />
            </div>

            {/* Color Customizer */}
            <div className={styles.fieldGroup} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <label className={styles.label}>Personalizar Categorías de Colores</label>
              <p className={styles.settingsDescription}>
                Escribe directamente sobre el nombre para renombrar un estado o haz clic sobre el color para cambiarlo.
              </p>
              
              <div className={styles.colorConfigList}>
                {customColors.map(c => {
                  return (
                    <div key={c.id} className={styles.colorConfigItem}>
                      <div className={styles.colorLabelGroup}>
                        {/* Selector de color interactivo */}
                        <div className={styles.colorPickerWrapper}>
                          <input 
                            type="color" 
                            className={styles.inlineColorPicker} 
                            value={c.color} 
                            onChange={e => handleRecolorColor(c.id, e.target.value)}
                            title="Cambiar color del estado"
                          />
                          <span className={styles.colorDotPreview} style={{ backgroundColor: c.color }} />
                        </div>
                        {/* Input para renombrar en el acto */}
                        <input 
                          type="text" 
                          className={styles.inlineColorNameInput} 
                          value={c.name}
                          onChange={e => handleRenameColor(c.id, e.target.value)}
                          placeholder="Nombre del estado..."
                          title="Haz clic para renombrar"
                        />
                      </div>
                      
                      {customColors.length > 1 && (
                        <button 
                          className={styles.deleteColorBtn}
                          onClick={() => handleDeleteColor(c.id)}
                          title="Eliminar categoría"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={styles.addColorSectionHeader}>
                <h4>Añadir Nueva Categoría</h4>
              </div>

              <div className={styles.addColorForm}>
                <input 
                  type="color" 
                  className={styles.inputColorHex} 
                  value={newColorHex} 
                  onChange={e => setNewColorHex(e.target.value)} 
                  title="Elige color"
                />
                <input 
                  type="text" 
                  className={`${styles.input} ${styles.inputName}`} 
                  value={newColorName} 
                  onChange={e => setNewColorName(e.target.value)}
                  placeholder="Ej. Creativo, Ansioso..."
                />
                <select 
                  className={styles.input} 
                  style={{ padding: '0.2rem', maxWidth: '100px' }}
                  value={newColorValue} 
                  onChange={e => setNewColorValue(Number(e.target.value))}
                >
                  <option value={6}>Muy bueno</option>
                  <option value={5}>Bueno</option>
                  <option value={4}>Sin más</option>
                  <option value={3}>Aburrido</option>
                  <option value={2}>Malo</option>
                  <option value={1}>Muy malo</option>
                </select>
                <button className={styles.addBtn} onClick={handleAddColor} title="Añadir categoría">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <button className={styles.saveSettingsBtn} onClick={handleSaveSettings}>
              Guardar Ajustes
            </button>
          </section>
        )}

      </main>

      {/* Fixed Footer: LLM Advice & Trend Analysis */}
      <footer className={styles.llmFooter}>
        <div className={styles.footerSparkSection}>
          <Sparkles size={18} className={styles.iconSpark} />
          <span className={styles.footerLabel}>Consejo de Bienestar</span>
        </div>
        <p className={styles.footerContent}>
          {isGeneratingAdvice 
            ? 'Analizando tu estado de ánimo actual y la evolución de los últimos días...' 
            : savedAdvice 
              ? `"${savedAdvice}"` 
              : 'Selecciona o registra la jornada de hoy para ver tu análisis de bienestar y evolución...'
          }
        </p>
        <span className={styles.footerHelperText}>
          {savedAdvice ? 'IA Activa localmente' : ''}
        </span>
      </footer>

      {/* Proactive Floating Toast Notification (Emergency Push of EOD) */}
      {proactiveToast?.visible && (
        <div className={styles.proactiveToast}>
          <div className={styles.toastHeader}>
            <div className={styles.toastTitle}>
              <Bell size={16} />
              <span>Análisis de Fin de Día</span>
            </div>
            <button 
              className={styles.closeBtn} 
              onClick={() => setProactiveToast(null)}
            >
              <X size={16} />
            </button>
          </div>
          <p className={styles.toastBody}>
            "{proactiveToast.advice}"
          </p>
          <div className={styles.toastFooter}>
            Sugerencia generada hoy
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
