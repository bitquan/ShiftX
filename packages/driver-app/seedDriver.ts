import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-no-project';
const driverId = process.argv[2] || 'demo-driver';

const adminApp = getApps().length ? getApps()[0] : initializeApp({ projectId });
const auth = getAuth(adminApp);
const firestore = getFirestore(adminApp);

async function ensureDriver() {
  await firestore.collection('drivers').doc(driverId).set(
    {
      isOnline: false,
      isBusy: false,
      currentRideId: null,
      onboardingStatus: 'active',
      updatedAtMs: Date.now(),
      lastSeenAtMs: Date.now(),
    },
    { merge: true }
  );
  await firestore.collection('users').doc(driverId).set(
    {
      role: 'driver',
      displayName: 'Driver UI',
      createdAtMs: Date.now(),
    },
    { merge: true }
  );
  try {
    await auth.createUser({ uid: driverId });
  } catch (error) {
    if ((error as any)?.code !== 'auth/uid-already-exists') {
      throw error;
    }
  }
  console.log(`seeded driver ${driverId}`);
}

ensureDriver().catch((error) => {
  console.error('seed failed', error);
  process.exitCode = 1;
});
