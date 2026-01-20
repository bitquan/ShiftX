/**
 * Phase 3F: Safety Rails - Event Log System
 * 
 * Breadcrumb-style event logging for debugging ride flows.
 * Stores last 100 events in memory for DiagnosticsPanel.
 */

export type EventCategory = 
  | 'auth'
  | 'offer'
  | 'ride'
  | 'location'
  | 'navigation'
  | 'error'
  | 'system';

export interface EventLogEntry {
  id: string;
  timestamp: number;
  category: EventCategory;
  message: string;
  details?: Record<string, any>;
}

const MAX_EVENTS = 100;
const eventLog: EventLogEntry[] = [];
const listeners = new Set<() => void>();

let eventIdCounter = 0;

/**
 * Add an event to the log
 */
export function logEvent(
  category: EventCategory,
  message: string,
  details?: Record<string, any>
): void {
  const entry: EventLogEntry = {
    id: `evt_${++eventIdCounter}`,
    timestamp: Date.now(),
    category,
    message,
    details,
  };

  eventLog.unshift(entry);

  // Keep only last MAX_EVENTS
  if (eventLog.length > MAX_EVENTS) {
    eventLog.pop();
  }

  // Notify listeners
  listeners.forEach(listener => listener());

  // Also log to console in dev mode
  if (import.meta.env.DEV) {
    const emoji = getCategoryEmoji(category);
    const style = getCategoryStyle(category);
    console.log(
      `%c${emoji} [${category.toUpperCase()}] ${message}`,
      style,
      details || ''
    );
  }
}

/**
 * Get all events
 */
export function getEvents(): EventLogEntry[] {
  return [...eventLog];
}

/**
 * Get events by category
 */
export function getEventsByCategory(category: EventCategory): EventLogEntry[] {
  return eventLog.filter(e => e.category === category);
}

/**
 * Clear all events
 */
export function clearEvents(): void {
  eventLog.length = 0;
  listeners.forEach(listener => listener());
}

/**
 * Subscribe to event log changes
 */
export function subscribeToEvents(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Export events as JSON string
 */
export function exportEventsAsJSON(): string {
  return JSON.stringify(eventLog, null, 2);
}

/**
 * Get category emoji
 */
function getCategoryEmoji(category: EventCategory): string {
  switch (category) {
    case 'auth': return '🔐';
    case 'offer': return '📋';
    case 'ride': return '🚗';
    case 'location': return '📍';
    case 'navigation': return '🧭';
    case 'error': return '❌';
    case 'system': return '⚙️';
    default: return '📝';
  }
}

/**
 * Get category console style
 */
function getCategoryStyle(category: EventCategory): string {
  const baseStyle = 'font-weight: bold; padding: 2px 4px; border-radius: 3px;';
  
  switch (category) {
    case 'auth': return `${baseStyle} background: #3b82f6; color: white;`;
    case 'offer': return `${baseStyle} background: #8b5cf6; color: white;`;
    case 'ride': return `${baseStyle} background: #10b981; color: white;`;
    case 'location': return `${baseStyle} background: #06b6d4; color: white;`;
    case 'navigation': return `${baseStyle} background: #f59e0b; color: white;`;
    case 'error': return `${baseStyle} background: #ef4444; color: white;`;
    case 'system': return `${baseStyle} background: #6b7280; color: white;`;
    default: return `${baseStyle} background: #64748b; color: white;`;
  }
}
