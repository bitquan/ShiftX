import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface RuntimeFlags {
  disablePayments: boolean;
  disableNewRequests: boolean;
  disableDriverOnline: boolean;
  disableAcceptRide: boolean;
  maintenanceMessage?: string;
  enableStripeConnect?: boolean;
}

const DEFAULT_FLAGS: RuntimeFlags = {
  disablePayments: false,
  disableNewRequests: false,
  disableDriverOnline: false,
  disableAcceptRide: false,
  maintenanceMessage: '',
  enableStripeConnect: false,
};

let cachedFlags: RuntimeFlags = DEFAULT_FLAGS;
let flagsListener: (() => void) | null = null;

/**
 * Start listening to runtime flags changes
 * Call this once on app startup
 */
export function watchRuntimeFlags(onUpdate: (flags: RuntimeFlags) => void): () => void {
  const flagsRef = doc(db, 'config', 'runtimeFlags');
  
  flagsListener = onSnapshot(
    flagsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        cachedFlags = {
          ...DEFAULT_FLAGS,
          ...snapshot.data() as Partial<RuntimeFlags>,
        };
      } else {
        cachedFlags = DEFAULT_FLAGS;
      }
      
      console.log('[RuntimeFlags] Updated:', cachedFlags);
      onUpdate(cachedFlags);
    },
    (error) => {
      console.error('[RuntimeFlags] Error watching flags:', error);
      // Keep using cached flags on error
      onUpdate(cachedFlags);
    }
  );
  
  return flagsListener;
}

/**
 * Get current runtime flags (synchronous, uses cached value)
 */
export function getRuntimeFlags(): RuntimeFlags {
  return cachedFlags;
}

/**
 * Fetch runtime flags once (async)
 */
export async function fetchRuntimeFlags(): Promise<RuntimeFlags> {
  try {
    const flagsRef = doc(db, 'config', 'runtimeFlags');
    const snapshot = await getDoc(flagsRef);
    
    if (snapshot.exists()) {
      cachedFlags = {
        ...DEFAULT_FLAGS,
        ...snapshot.data() as Partial<RuntimeFlags>,
      };
    } else {
      cachedFlags = DEFAULT_FLAGS;
    }
    
    return cachedFlags;
  } catch (error) {
    console.error('[RuntimeFlags] Error fetching flags:', error);
    return cachedFlags; // Return last known flags
  }
}
