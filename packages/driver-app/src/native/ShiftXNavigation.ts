/**
 * Phase 4B: Native Mapbox Navigation Plugin
 * 
 * Capacitor plugin for turn-by-turn navigation using Mapbox Navigation SDK.
 * Provides native iOS and Android navigation UI that's launched from the driver app.
 */

import { registerPlugin } from '@capacitor/core';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface NavigationOptions {
  lat: number;
  lng: number;
  label?: string; // e.g., "Pickup at Main St"
  mode?: 'driving' | 'walking'; // Default: driving
}

export interface NavigationEvent {
  timestamp: number;
  message?: string;
}

export interface NavigationErrorEvent extends NavigationEvent {
  error: string;
  code?: string;
}

export interface ShiftXNavigationPlugin {
  /**
   * Start native turn-by-turn navigation to destination
   * Opens native navigation UI (modal on iOS, Activity on Android)
   */
  start(options: NavigationOptions): Promise<{ started: boolean }>;

  /**
   * Stop/dismiss native navigation
   * Closes navigation UI and returns to MapShell
   */
  stop(): Promise<{ stopped: boolean }>;

  /**
   * Update destination mid-navigation (e.g., pickup → dropoff)
   * Optional: Some implementations may require stop/start instead
   */
  setDestination(options: NavigationOptions): Promise<{ updated: boolean }>;

  /**
   * Check if native navigation is available
   * Returns false if plugin not available or SDK not configured
   */
  isAvailable(): Promise<{ available: boolean; reason?: string }>;

  /**
   * Add listener for navigation started
   */
  addListener(
    eventName: 'navStarted',
    listenerFunc: (event: NavigationEvent) => void
  ): Promise<any>;

  /**
   * Add listener for navigation ended (user cancelled or arrived)
   */
  addListener(
    eventName: 'navEnded',
    listenerFunc: (event: NavigationEvent) => void
  ): Promise<any>;

  /**
   * Add listener for navigation errors
   */
  addListener(
    eventName: 'navError',
    listenerFunc: (event: NavigationErrorEvent) => void
  ): Promise<any>;

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(eventName?: string): Promise<void>;
}

const ShiftXNavigation = registerPlugin<ShiftXNavigationPlugin>('ShiftXNavigation', {
  web: () => import('./ShiftXNavigationWeb').then(m => new m.ShiftXNavigationWeb()),
});

export default ShiftXNavigation;
