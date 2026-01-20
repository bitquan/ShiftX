import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { callableOptions } from './cors';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper to detect if running in emulator
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_EMULATOR_HUB;
}

type StripeMode = 'test' | 'live';

function getStripeMode(): StripeMode {
  if (isEmulator()) return 'test';
  return process.env.STRIPE_MODE === 'test' ? 'test' : 'live';
}

// Helper function to check if user is admin
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const adminConfigSnap = await db.collection('config').doc('admins').get();
    if (adminConfigSnap.exists) {
      const adminUids = adminConfigSnap.data()?.uids || [];
      return adminUids.includes(uid);
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
  }
  return false;
}

/**
 * driverSetOnline - Sets driver online/offline status
 */
export const driverSetOnline = onCall<{ online: boolean }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { online } = request.data;
    if (typeof online !== 'boolean') {
      throw new HttpsError('invalid-argument', 'online must be a boolean');
    }

    const driverRef = db.collection('drivers').doc(uid);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists) {
      throw new HttpsError('not-found', 'Driver profile not found');
    }

    const driver = driverSnap.data();

    // Check if driver is approved or has admin bypass
    if (online) {
      const userIsAdmin = await isAdmin(uid);
      const driverApproved = driver?.approved === true;
      const hasAdminBypass = driver?.approvalBypassByAdmin === true;
      
      if (!userIsAdmin && !driverApproved && !hasAdminBypass) {
        throw new HttpsError(
          'permission-denied',
          'Driver must be approved before going online'
        );
      }
    }

    // Can't go offline while busy
    if (!online && driver?.isBusy) {
      throw new HttpsError('failed-precondition', 'Cannot go offline while busy');
    }

    await driverRef.update({
      isOnline: online,
      updatedAtMs: Date.now(),
      lastSeenAtMs: Date.now(),
    });

    return { ok: true };
  }
);

/**
 * driverHeartbeat - Updates driver's lastSeenAtMs timestamp and location
 */
export const driverHeartbeat = onCall<{ lat?: number; lng?: number }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const updateData: any = {
      lastSeenAtMs: Date.now(),
      lastHeartbeatMs: Date.now(),
    };

    // If location is provided, save it
    if (request.data?.lat !== undefined && request.data?.lng !== undefined) {
      updateData.location = {
        lat: request.data.lat,
        lng: request.data.lng,
      };
    }

    await db.collection('drivers').doc(uid).update(updateData);

    // If driver has an active ride, also update the ride's driverLocation
    const driverSnap = await db.collection('drivers').doc(uid).get();
    const driverData = driverSnap.data();
    
    if (driverData?.currentRideId && updateData.location) {
      await db.collection('rides').doc(driverData.currentRideId).update({
        driverLocation: updateData.location,
        updatedAtMs: Date.now(),
      });
    }

    return { ok: true };
  }
);

/**
 * setDriverAvailability - Sets driver's weekly availability schedule
 */
interface AvailabilityInterval {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
}

export const setDriverAvailability = onCall<{
  timezone: string;
  intervals: AvailabilityInterval[];
}>(callableOptions, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { timezone, intervals } = request.data;

  if (!timezone || typeof timezone !== 'string') {
    throw new HttpsError('invalid-argument', 'timezone is required');
  }

  if (!Array.isArray(intervals)) {
    throw new HttpsError('invalid-argument', 'intervals must be an array');
  }

  // Validate intervals
  for (const interval of intervals) {
    if (
      typeof interval.dayOfWeek !== 'number' ||
      interval.dayOfWeek < 0 ||
      interval.dayOfWeek > 6
    ) {
      throw new HttpsError('invalid-argument', 'dayOfWeek must be between 0 and 6');
    }
    if (
      typeof interval.startMinutes !== 'number' ||
      typeof interval.endMinutes !== 'number' ||
      interval.startMinutes < 0 ||
      interval.endMinutes > 1440 ||
      interval.startMinutes >= interval.endMinutes
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Invalid time interval: startMinutes must be less than endMinutes'
      );
    }
  }

  const driverRef = db.collection('drivers').doc(uid);
  await driverRef.update({
    availability: {
      timezone,
      intervals,
      updatedAtMs: Date.now(),
    },
    updatedAtMs: Date.now(),
  });

  return { ok: true };
});

/**
 * getDriverLedgerSummary - Returns driver earnings summary and recent ledger entries
 */
interface LedgerEntry {
  rideId: string;
  amountCents: number;
  createdAtMs: number;
  type: string;
  status: string;
}

interface LedgerSummary {
  todayCents: number;
  weekCents: number;
  entries: LedgerEntry[];
}

export const getDriverLedgerSummary = onCall<Record<string, never>>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartMs = weekStart.getTime();

    // Query ledger entries for this driver
    const ledgerSnapshot = await db
      .collection('drivers')
      .doc(uid)
      .collection('ledger')
      .orderBy('createdAtMs', 'desc')
      .limit(50)
      .get();

    const entries: LedgerEntry[] = [];
    let todayCents = 0;
    let weekCents = 0;

    ledgerSnapshot.forEach((doc) => {
      const data = doc.data();
      const entry: LedgerEntry = {
        rideId: data.rideId || '',
        amountCents: data.amountCents || 0,
        createdAtMs: data.createdAtMs || 0,
        type: data.type || 'ride_earnings',
        status: data.status || 'pending',
      };

      entries.push(entry);

      // Count trip earnings (completed by default)
      if (entry.type === 'trip_earning' || entry.status === 'completed' || entry.status === 'settled') {
        if (entry.createdAtMs >= todayStartMs) {
          todayCents += entry.amountCents;
        }
        if (entry.createdAtMs >= weekStartMs) {
          weekCents += entry.amountCents;
        }
      }
    });

    const summary: LedgerSummary = {
      todayCents,
      weekCents,
      entries: entries.slice(0, 20), // Return last 20 entries
    };

    return summary;
  }
);

/**
 * approveDriver - Admin function to approve or disable a driver
 */
export const approveDriver = onCall<{ driverId: string; approved: boolean }>(
  callableOptions,
  async (request) => {
    const adminUid = request.auth?.uid;
    if (!adminUid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if caller is admin
    const userIsAdmin = await isAdmin(adminUid);
    if (!userIsAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can approve drivers');
    }

    const { driverId, approved } = request.data;
    if (!driverId || typeof driverId !== 'string') {
      throw new HttpsError('invalid-argument', 'driverId must be a string');
    }
    if (typeof approved !== 'boolean') {
      throw new HttpsError('invalid-argument', 'approved must be a boolean');
    }

    // Update driver approval status
    const driverRef = db.collection('drivers').doc(driverId);
    const driverSnap = await driverRef.get();
    
    if (!driverSnap.exists) {
      throw new HttpsError('not-found', 'Driver not found');
    }

    await driverRef.update({
      approved,
      updatedAtMs: Date.now(),
    });

    // If disabling, also set them offline
    if (!approved) {
      await driverRef.update({
        isOnline: false,
      });
    }

    // Get admin and driver details for logging
    const adminDoc = await db.collection('users').doc(adminUid).get();
    const adminEmail = adminDoc.data()?.email || 'unknown';
    const driverData = driverSnap.data();
    const driverEmail = driverData?.email || 'unknown';

    // Log the action with full details
    await db.collection('adminLogs').add({
      adminUid,
      adminEmail,
      action: approved ? 'approve_driver' : 'disable_driver',
      details: {
        driverId,
        driverEmail,
        approved,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampMs: Date.now(),
    });

    return { ok: true };
  }
);

/**
 * toggleApprovalBypass - Admin function to toggle approval bypass for a driver
 * Allows admins to let drivers work without document verification in exceptional cases
 */
export const toggleApprovalBypass = onCall<{ driverId: string; bypass: boolean }>(
  callableOptions,
  async (request) => {
    const adminUid = request.auth?.uid;
    if (!adminUid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if caller is admin
    const userIsAdmin = await isAdmin(adminUid);
    if (!userIsAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can toggle approval bypass');
    }

    const { driverId, bypass } = request.data;
    if (!driverId || typeof driverId !== 'string') {
      throw new HttpsError('invalid-argument', 'driverId must be a string');
    }
    if (typeof bypass !== 'boolean') {
      throw new HttpsError('invalid-argument', 'bypass must be a boolean');
    }

    // Update driver bypass status
    const driverRef = db.collection('drivers').doc(driverId);
    const driverSnap = await driverRef.get();
    
    if (!driverSnap.exists) {
      throw new HttpsError('not-found', 'Driver not found');
    }

    await driverRef.update({
      approvalBypassByAdmin: bypass,
      updatedAtMs: Date.now(),
    });

    // Get admin and driver details for logging
    const adminDoc = await db.collection('users').doc(adminUid).get();
    const adminEmail = adminDoc.data()?.email || 'unknown';
    const driverData = driverSnap.data();
    const driverEmail = driverData?.email || 'unknown';

    // Log the action with full details
    await db.collection('adminLogs').add({
      adminUid,
      adminEmail,
      action: bypass ? 'enable_approval_bypass' : 'disable_approval_bypass',
      details: {
        driverId,
        driverEmail,
        bypass,
        warning: 'Bypass allows driver to work without document verification',
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampMs: Date.now(),
    });

    return { ok: true };
  }
);

/**
 * listDrivers - Admin function to list all drivers (for admin panel)
 */
export const listDrivers = onCall<Record<string, never>>(
  callableOptions,
  async (request) => {
    const adminUid = request.auth?.uid;
    if (!adminUid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if caller is admin
    const userIsAdmin = await isAdmin(adminUid);
    if (!userIsAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can list drivers');
    }

    const driversSnapshot = await db.collection('drivers').get();
    const usersSnapshot = await db.collection('users').get();

    // Create a map of user data
    const usersMap = new Map();
    usersSnapshot.forEach((doc) => {
      usersMap.set(doc.id, doc.data());
    });

    const drivers: any[] = [];
    const stripeMode = getStripeMode();
    const accountIdField = stripeMode === 'test' ? 'stripeConnectAccountId_test' : 'stripeConnectAccountId_live';
    const statusField = stripeMode === 'test' ? 'stripeConnectStatus_test' : 'stripeConnectStatus_live';
    driversSnapshot.forEach((doc) => {
      const driverData = doc.data();
      const userData = usersMap.get(doc.id);
      
      drivers.push({
        uid: doc.id,
        email: userData?.email || '',
        photoURL: userData?.photoURL || null,
        approved: driverData?.approved || false,
        isOnline: driverData?.isOnline || false,
        vehicleClass: driverData?.vehicleClass || null,
        vehicleInfo: driverData?.vehicleInfo || null,
        stripeConnectAccountId: driverData?.[accountIdField] || null,
        stripeConnectStatus: driverData?.[statusField] || 'none',
        connectEnabledOverride: driverData?.connectEnabledOverride || false,
        createdAtMs: driverData?.createdAtMs || 0,
        stripeConnectMode: stripeMode,
      });
    });

    return { drivers };
  }
);

/**
 * setPreferredDriver - Customer sets a preferred driver
 */
export const setPreferredDriver = onCall<{ driverId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { driverId } = request.data;
    if (!driverId || typeof driverId !== 'string') {
      throw new HttpsError('invalid-argument', 'driverId is required');
    }

    // Check if driver exists
    const driverRef = db.collection('drivers').doc(driverId);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists) {
      throw new HttpsError('not-found', 'Driver not found');
    }

    // Update or create customer's preferred driver
    const customerRef = db.collection('customers').doc(uid);
    await customerRef.set({
      preferredDriverId: driverId,
      updatedAtMs: Date.now(),
    }, { merge: true });

    // Log the action
    await db.collection('adminLogs').add({
      action: 'customer_set_preferred_driver',
      customerId: uid,
      driverId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampMs: Date.now(),
    });

    return { ok: true, driverId };
  }
);

/**
 * toggleConnectPilot - Admin function to enable/disable Stripe Connect for a specific driver
 */
export const toggleConnectPilot = onCall<{ driverId: string; enabled: boolean }>(
  callableOptions,
  async (request) => {
    const adminUid = request.auth?.uid;
    if (!adminUid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if caller is admin
    const userIsAdmin = await isAdmin(adminUid);
    if (!userIsAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can toggle pilot status');
    }

    const { driverId, enabled } = request.data;
    if (!driverId || typeof driverId !== 'string') {
      throw new HttpsError('invalid-argument', 'driverId is required');
    }
    if (typeof enabled !== 'boolean') {
      throw new HttpsError('invalid-argument', 'enabled must be a boolean');
    }

    // Check if driver exists
    const driverRef = db.collection('drivers').doc(driverId);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists) {
      throw new HttpsError('not-found', 'Driver not found');
    }

    const driverData = driverSnap.data();
    const stripeMode = getStripeMode();
    const accountIdField = stripeMode === 'test' ? 'stripeConnectAccountId_test' : 'stripeConnectAccountId_live';
    const statusField = stripeMode === 'test' ? 'stripeConnectStatus_test' : 'stripeConnectStatus_live';

    // Verify driver has Connect account and is active before enabling
    if (enabled) {
      if (!driverData?.[accountIdField]) {
        throw new HttpsError(
          'failed-precondition',
          'Driver must have a Stripe Connect account before enabling pilot'
        );
      }
      if (driverData?.[statusField] !== 'active') {
        throw new HttpsError(
          'failed-precondition',
          `Driver Connect status is "${driverData?.[statusField]}", must be "active" before enabling pilot`
        );
      }
    }

    // Update driver's pilot status
    await driverRef.update({
      connectEnabledOverride: enabled,
      updatedAtMs: Date.now(),
    });

    // Get admin details for logging
    const adminDoc = await db.collection('users').doc(adminUid).get();
    const adminEmail = adminDoc.data()?.email || 'unknown';

    // Log the action
    await db.collection('adminLogs').add({
      adminUid,
      adminEmail,
      action: enabled ? 'enable_connect_pilot' : 'disable_connect_pilot',
      details: {
        driverId,
        driverEmail: driverData?.email || 'unknown',
        enabled,
        stripeConnectAccountId: driverData?.[accountIdField] || null,
        stripeConnectMode: stripeMode,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampMs: Date.now(),
    });

    console.log(`[toggleConnectPilot] ${enabled ? 'Enabled' : 'Disabled'} Connect pilot for driver ${driverId}`);

    return { ok: true, enabled };
  }
);
