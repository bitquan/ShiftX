import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface LogErrorParams {
  error: Error | string;
  context?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  additionalData?: Record<string, any>;
}

/**
 * Global error logger - use this to manually log errors
 * 
 * @example
 * try {
 *   await someRiskyOperation();
 * } catch (error) {
 *   logError({ error, context: 'someRiskyOperation', severity: 'high' });
 *   // Handle error...
 * }
 */
export async function logError({ error, context, severity = 'medium', additionalData }: LogErrorParams): Promise<void> {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  
  // Log to console immediately
  console.error(`[${severity.toUpperCase()}] Error in ${context || 'unknown'}:`, errorObj, additionalData);
  
  try {
    const logErrorFn = httpsCallable(functions, 'logError');
    await logErrorFn({
      error: errorObj.name || 'Error',
      message: `${context ? `[${context}] ` : ''}${errorObj.message}`,
      stack: errorObj.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      severity,
      source: 'driver-app',
      environment: import.meta.env.MODE,
      ...additionalData,
    });
  } catch (logErr) {
    console.error('Failed to log error to Cloud Functions:', logErr);
  }
}

/**
 * Wrap a promise to automatically log errors
 * 
 * @example
 * await withErrorLogging(
 *   someAsyncOperation(),
 *   'someAsyncOperation',
 *   'high'
 * );
 */
export async function withErrorLogging<T>(
  promise: Promise<T>,
  context: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<T> {
  try {
    return await promise;
  } catch (error: any) {
    await logError({ error, context, severity });
    throw error; // Re-throw so caller can handle
  }
}
