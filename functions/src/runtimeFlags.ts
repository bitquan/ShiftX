// Runtime Flags - System-wide kill switches
export interface RuntimeFlags {
  disablePayments: boolean; // If true, prevent payment authorization/capture
  disableNewRequests: boolean; // If true, prevent customers from requesting rides
  disableDriverOnline: boolean; // If true, prevent drivers from going online
  disableAcceptRide: boolean; // If true, prevent drivers from accepting rides
  maintenanceMessage?: string; // Optional message to display to users
  enabledFeatures?: {
    stripePayments?: boolean;
    locationTracking?: boolean;
    offerBroadcast?: boolean;
  };
}

export const DEFAULT_RUNTIME_FLAGS: RuntimeFlags = {
  disablePayments: false,
  disableNewRequests: false,
  disableDriverOnline: false,
  disableAcceptRide: false,
  maintenanceMessage: '',
  enabledFeatures: {
    stripePayments: true,
    locationTracking: true,
    offerBroadcast: true,
  },
};

/**
 * Get runtime flags from Firestore
 * Apps should check these flags on startup and periodically
 */
export async function getRuntimeFlags(db: FirebaseFirestore.Firestore): Promise<RuntimeFlags> {
  try {
    const flagsDoc = await db.collection('config').doc('runtimeFlags').get();
    
    if (!flagsDoc.exists) {
      return DEFAULT_RUNTIME_FLAGS;
    }
    
    return {
      ...DEFAULT_RUNTIME_FLAGS,
      ...flagsDoc.data() as Partial<RuntimeFlags>,
    };
  } catch (error) {
    console.error('[RuntimeFlags] Failed to fetch flags:', error);
    // Return safe defaults on error
    return DEFAULT_RUNTIME_FLAGS;
  }
}

/**
 * Check if a specific flag is enabled
 */
export function isFlagEnabled(flags: RuntimeFlags, flagName: keyof RuntimeFlags): boolean {
  return flags[flagName] === true;
}
