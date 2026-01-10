import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getInitializedClient } from '@shiftx/driver-client';
import { useToast } from './Toast';

interface TimeInterval {
  startMinutes: number;
  endMinutes: number;
}

interface WeeklyAvailability {
  [dayOfWeek: number]: TimeInterval[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  
  // Convert to 12-hour format with AM/PM
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

export function Availability() {
  const { show } = useToast();
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [availability, setAvailability] = useState<WeeklyAvailability>({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [useHourlyMode, setUseHourlyMode] = useState(true);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');

  const handleToggleHour = (hour: number) => {
    const newSet = new Set(selectedHours);
    if (newSet.has(hour)) {
      newSet.delete(hour);
    } else {
      newSet.add(hour);
    }
    setSelectedHours(newSet);
  };

  const handleAddHourlyIntervals = (day: number) => {
    if (selectedHours.size === 0) {
      show('Please select at least one hour', 'error');
      return;
    }

    const sortedHours = Array.from(selectedHours).sort((a, b) => a - b);
    const intervals: TimeInterval[] = [];
    
    let rangeStart = sortedHours[0];
    let rangeEnd = sortedHours[0];

    for (let i = 1; i < sortedHours.length; i++) {
      if (sortedHours[i] === rangeEnd + 1) {
        rangeEnd = sortedHours[i];
      } else {
        intervals.push({
          startMinutes: rangeStart * 60,
          endMinutes: (rangeEnd + 1) * 60,
        });
        rangeStart = sortedHours[i];
        rangeEnd = sortedHours[i];
      }
    }
    
    intervals.push({
      startMinutes: rangeStart * 60,
      endMinutes: (rangeEnd + 1) * 60,
    });

    setAvailability({
      ...availability,
      [day]: [...(availability[day] || []), ...intervals],
    });
    setSelectedHours(new Set());
    setEditingDay(null);
  };

  const handleAddInterval = (day: number) => {
    const startMinutes = timeToMinutes(newStart);
    const endMinutes = timeToMinutes(newEnd);

    if (startMinutes >= endMinutes) {
      show('Start time must be before end time', 'error');
      return;
    }

    setAvailability({
      ...availability,
      [day]: [...(availability[day] || []), { startMinutes, endMinutes }],
    });
    setEditingDay(null);
    setNewStart('09:00');
    setNewEnd('17:00');
  };

  const handleRemoveInterval = (day: number, index: number) => {
    const intervals = availability[day];
    setAvailability({
      ...availability,
      [day]: intervals.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { functions } = getInitializedClient();
      const callable = httpsCallable(functions, 'setDriverAvailability');
      
      const intervals: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> = [];
      Object.entries(availability).forEach(([day, dayIntervals]) => {
        dayIntervals.forEach((interval: TimeInterval) => {
          intervals.push({
            dayOfWeek: Number(day),
            startMinutes: interval.startMinutes,
            endMinutes: interval.endMinutes,
          });
        });
      });

      await callable({ timezone, intervals });
      show('Availability saved successfully', 'success');
    } catch (error) {
      show(`Failed to save availability: ${(error as Error).message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="availability">
      <h2>⏰ Set Your Availability</h2>
      <p className="text-muted">Set the hours when you're available to accept scheduled rides</p>

      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          Timezone: <strong>{timezone}</strong>
        </label>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {DAYS.map((dayName, dayIndex) => (
          <div
            key={dayIndex}
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{dayName}</strong>
              <button
                onClick={() => setEditingDay(editingDay === dayIndex ? null : dayIndex)}
                className="secondary-button"
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              >
                {editingDay === dayIndex ? 'Cancel' : '+ Add hours'}
              </button>
            </div>

            {availability[dayIndex] && availability[dayIndex].length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                {availability[dayIndex].map((interval, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '4px',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span>
                      {minutesToTime(interval.startMinutes)} - {minutesToTime(interval.endMinutes)}
                    </span>
                    <button
                      onClick={() => handleRemoveInterval(dayIndex, idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '1rem',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {editingDay === dayIndex && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={useHourlyMode}
                      onChange={() => {
                        setUseHourlyMode(true);
                        setSelectedHours(new Set());
                      }}
                      style={{ marginRight: '0.35rem' }}
                    />
                    Hourly
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={!useHourlyMode}
                      onChange={() => setUseHourlyMode(false)}
                      style={{ marginRight: '0.35rem' }}
                    />
                    Time Range
                  </label>
                </div>

                {useHourlyMode ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.5rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      {HOURS.map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => handleToggleHour(hour)}
                          style={{
                            padding: '0.5rem',
                            fontSize: '0.8rem',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            background: selectedHours.has(hour)
                              ? '#10b981'
                              : 'rgba(255,255,255,0.1)',
                            color: selectedHours.has(hour) ? 'white' : 'rgba(255,255,255,0.8)',
                            fontWeight: selectedHours.has(hour) ? '600' : '400',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatHour(hour)}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAddHourlyIntervals(dayIndex)}
                      disabled={selectedHours.size === 0}
                      className="primary-button"
                      style={{ fontSize: '0.8rem', padding: '8px 12px', width: '100%' }}
                    >
                      Add Selected Hours
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="time"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: 'none' }}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: 'none' }}
                    />
                    <button
                      onClick={() => handleAddInterval(dayIndex)}
                      className="primary-button"
                      style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="primary-button"
        style={{ width: '100%', marginTop: '1rem' }}
      >
        {isSaving ? 'Saving...' : 'Save Availability'}
      </button>
    </div>
  );
}
