import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { callableOptions } from './cors';

const db = admin.firestore();

interface LogErrorRequest {
  error: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  source?: 'driver-app' | 'customer-app' | 'admin-dashboard';
  appVersion?: string;
  environment?: string;
}

/**
 * logError - Log runtime errors for debugging
 */
export const logError = onCall<LogErrorRequest>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    
    const {
      error,
      message,
      stack,
      componentStack,
      url,
      userAgent,
      severity = 'medium',
      source,
      appVersion,
      environment
    } = request.data;

    if (!error || !message) {
      throw new HttpsError('invalid-argument', 'error and message are required');
    }

    try {
      // Get user details if authenticated
      let userEmail = 'anonymous';
      if (uid) {
        try {
          const userDoc = await db.collection('users').doc(uid).get();
          if (userDoc.exists) {
            userEmail = userDoc.data()?.email || uid;
          }
        } catch (err) {
          console.error('Failed to fetch user email:', err);
        }
      }

      // Log to Firestore
      await db.collection('errorLogs').add({
        error,
        message,
        stack: stack || null,
        componentStack: componentStack || null,
        url: url || null,
        userAgent: userAgent || null,
        userId: uid || null,
        userEmail,
        severity,
        source: source || 'unknown',
        appVersion: appVersion || null,
        environment: environment || 'production',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        timestampMs: Date.now(),
      });

      // Log to console for immediate visibility
      console.error(`[${severity?.toUpperCase()}] ${source || 'Unknown'} Error:`, {
        error,
        message,
        userEmail,
        url,
      });

      return { ok: true };
    } catch (err: any) {
      console.error('Failed to log error:', err);
      // Don't throw - we don't want error logging to break the app
      return { ok: false, error: err.message };
    }
  }
);
