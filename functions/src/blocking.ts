/**
 * Blocking and Reporting Functions
 * 
 * Allows drivers to block customers and all users to report issues
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

const callableOptions = {
  enforceAppCheck: false,
  cors: true,
};

/**
 * driverBlockCustomer - Driver blocks a customer from receiving future ride offers
 */
export const driverBlockCustomer = onCall<{
  customerId: string;
  reason?: string;
}>(
  callableOptions,
  async (request) => {
    const driverId = request.auth?.uid;
    if (!driverId) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Verify caller is a driver
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    if (!driverDoc.exists) {
      throw new HttpsError('permission-denied', 'Only drivers can block customers');
    }

    const { customerId, reason } = request.data;
    if (!customerId || typeof customerId !== 'string') {
      throw new HttpsError('invalid-argument', 'customerId must be a string');
    }

    // Verify customer exists
    const customerDoc = await db.collection('users').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new HttpsError('not-found', 'Customer not found');
    }

    // Add to blocked customers subcollection
    await db
      .collection('drivers')
      .doc(driverId)
      .collection('blockedCustomers')
      .doc(customerId)
      .set({
        customerId,
        customerEmail: customerDoc.data()?.email || '',
        reason: reason || '',
        blockedAtMs: Date.now(),
        blockedAt: FieldValue.serverTimestamp(),
      });

    console.log(`[driverBlockCustomer] Driver ${driverId} blocked customer ${customerId}`);

    return { ok: true };
  }
);

/**
 * driverUnblockCustomer - Driver unblocks a previously blocked customer
 */
export const driverUnblockCustomer = onCall<{
  customerId: string;
}>(
  callableOptions,
  async (request) => {
    const driverId = request.auth?.uid;
    if (!driverId) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Verify caller is a driver
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    if (!driverDoc.exists) {
      throw new HttpsError('permission-denied', 'Only drivers can unblock customers');
    }

    const { customerId } = request.data;
    if (!customerId || typeof customerId !== 'string') {
      throw new HttpsError('invalid-argument', 'customerId must be a string');
    }

    // Remove from blocked customers
    await db
      .collection('drivers')
      .doc(driverId)
      .collection('blockedCustomers')
      .doc(customerId)
      .delete();

    console.log(`[driverUnblockCustomer] Driver ${driverId} unblocked customer ${customerId}`);

    return { ok: true };
  }
);

/**
 * createReport - Create a report about a user or ride issue
 */
export const createReport = onCall<{
  targetUid: string;
  targetRole: 'customer' | 'driver';
  rideId?: string;
  reason: string;
  category?: string;
}>(
  callableOptions,
  async (request) => {
    const reporterUid = request.auth?.uid;
    if (!reporterUid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { targetUid, targetRole, rideId, reason, category } = request.data;

    // Validation
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid must be a string');
    }
    if (!targetRole || !['customer', 'driver'].includes(targetRole)) {
      throw new HttpsError('invalid-argument', 'targetRole must be customer or driver');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'reason is required');
    }

    // Get reporter info
    const reporterDoc = await db.collection('users').doc(reporterUid).get();
    const reporterEmail = reporterDoc.data()?.email || 'unknown';

    // Get target user info
    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      throw new HttpsError('not-found', 'Target user not found');
    }
    const targetEmail = targetDoc.data()?.email || 'unknown';

    // Create report
    const reportRef = await db.collection('reports').add({
      reporterUid,
      reporterEmail,
      targetUid,
      targetEmail,
      targetRole,
      rideId: rideId || null,
      reason: reason.trim(),
      category: category || 'other',
      status: 'pending',
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`[createReport] User ${reporterUid} reported ${targetRole} ${targetUid}`);

    return { ok: true, reportId: reportRef.id };
  }
);

/**
 * getBlockedCustomers - Get list of customers blocked by this driver
 */
export const getBlockedCustomers = onCall(
  callableOptions,
  async (request) => {
    const driverId = request.auth?.uid;
    if (!driverId) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Verify caller is a driver
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    if (!driverDoc.exists) {
      throw new HttpsError('permission-denied', 'Only drivers can view blocked customers');
    }

    // Get blocked customers
    const blockedSnapshot = await db
      .collection('drivers')
      .doc(driverId)
      .collection('blockedCustomers')
      .orderBy('blockedAtMs', 'desc')
      .get();

    const blocked = blockedSnapshot.docs.map(doc => ({
      customerId: doc.id,
      ...doc.data(),
    }));

    return { blocked };
  }
);
