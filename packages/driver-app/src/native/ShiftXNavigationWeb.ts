/**
 * Phase 4B: Web fallback for ShiftXNavigation
 * 
 * On web (desktop browser), native navigation is not available.
 * This stub returns unavailable and allows fallback to external maps links.
 */

import { WebPlugin } from '@capacitor/core';
import type { 
  ShiftXNavigationPlugin, 
  NavigationOptions 
} from './ShiftXNavigation';

export class ShiftXNavigationWeb extends WebPlugin implements ShiftXNavigationPlugin {
  async start(options: NavigationOptions): Promise<{ started: boolean }> {
    console.log('[ShiftXNavigation] Web: start() called but native nav not available', options);
    return { started: false };
  }

  async stop(): Promise<{ stopped: boolean }> {
    console.log('[ShiftXNavigation] Web: stop() called but native nav not available');
    return { stopped: false };
  }

  async setDestination(options: NavigationOptions): Promise<{ updated: boolean }> {
    console.log('[ShiftXNavigation] Web: setDestination() called but native nav not available', options);
    return { updated: false };
  }

  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    return { 
      available: false, 
      reason: 'Native navigation only available on iOS/Android' 
    };
  }
}
