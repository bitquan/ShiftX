#!/usr/bin/env node

/**
 * Production Connect LIVE-gating verification.
 *
 * This script signs in as:
 * - a NON-allowlisted driver (should be blocked in LIVE mode)
 * - an allowlisted driver (should be allowed in LIVE mode)
 *
 * It calls the callable function `getConnectStatus` and reports results.
 *
 * Required env vars:
 *   VERIFY_BLOCKED_DRIVER_EMAIL
 *   VERIFY_BLOCKED_DRIVER_PASSWORD
 *   VERIFY_ALLOWED_DRIVER_EMAIL
 *   VERIFY_ALLOWED_DRIVER_PASSWORD
 *
 * Optional:
 *   FIREBASE_PROJECT_ID (default: shiftx-95c4b)
 *   FIREBASE_API_KEY (default: uses the existing repo fallback)
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFunctions, httpsCallable } = require('firebase/functions');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'shiftx-95c4b';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU';

const required = [
  'VERIFY_BLOCKED_DRIVER_EMAIL',
  'VERIFY_BLOCKED_DRIVER_PASSWORD',
  'VERIFY_ALLOWED_DRIVER_EMAIL',
  'VERIFY_ALLOWED_DRIVER_PASSWORD',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required env vars:');
  for (const k of missing) console.error(`   ${k}`);
  console.error('\nExample:');
  console.error(
    '  VERIFY_BLOCKED_DRIVER_EMAIL=a@b.com \\\n  VERIFY_BLOCKED_DRIVER_PASSWORD=... \\\n  VERIFY_ALLOWED_DRIVER_EMAIL=c@d.com \\\n  VERIFY_ALLOWED_DRIVER_PASSWORD=... \\\n  node scripts/verifyConnectGate.js\n'
  );
  process.exit(1);
}

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'us-central1');

async function callGetConnectStatus(label) {
  const fn = httpsCallable(functions, 'getConnectStatus');
  try {
    const result = await fn({});
    return { ok: true, data: result.data, label };
  } catch (err) {
    const e = err || {};
    return {
      ok: false,
      label,
      code: e.code,
      message: e.message,
      details: e.details,
    };
  }
}

async function runOne({ label, email, password }) {
  await signOut(auth).catch(() => undefined);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const res = await callGetConnectStatus(label);
  res.uid = uid;
  res.email = email;
  return res;
}

function printResult(res) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔎 ${res.label}`);
  console.log(`   email: ${res.email}`);
  console.log(`   uid:   ${res.uid}`);
  if (res.ok) {
    console.log('   result: OK');
    console.log(`   mode: ${res.data?.mode}`);
    console.log(`   hasAccount: ${res.data?.hasAccount}`);
    console.log(`   status: ${res.data?.status}`);
  } else {
    console.log('   result: ERROR');
    console.log(`   code: ${res.code}`);
    console.log(`   message: ${res.message}`);
  }
}

(async () => {
  console.log('\n🧪 ShiftX Prod Connect LIVE-gate verification');
  console.log(`Project: ${FIREBASE_PROJECT_ID}`);

  const blocked = await runOne({
    label: 'NON-allowlisted driver (should be BLOCKED in LIVE mode)',
    email: process.env.VERIFY_BLOCKED_DRIVER_EMAIL,
    password: process.env.VERIFY_BLOCKED_DRIVER_PASSWORD,
  });
  printResult(blocked);

  const allowed = await runOne({
    label: 'Allowlisted driver (should be ALLOWED in LIVE mode)',
    email: process.env.VERIFY_ALLOWED_DRIVER_EMAIL,
    password: process.env.VERIFY_ALLOWED_DRIVER_PASSWORD,
  });
  printResult(allowed);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Heuristic pass/fail guidance
  const notes = [];

  const blockedIsGateError =
    blocked.ok === false &&
    typeof blocked.message === 'string' &&
    blocked.message.includes('LIVE Connect is disabled');

  if (!blockedIsGateError && blocked.ok) {
    notes.push('Blocked user was not blocked; either STRIPE_MODE is not live or gating flags are enabled for everyone.');
  }

  if (blocked.ok && blocked.data?.mode !== 'live') {
    notes.push(`Blocked user returned mode=${blocked.data?.mode}; to test LIVE gating you must deploy with STRIPE_MODE=live.`);
  }

  if (!allowed.ok) {
    notes.push('Allowlisted user errored; ensure enableStripeConnect=true, STRIPE_MODE=live, allowLivePayments=true, and UID is in livePaymentPilotUids.');
  }

  if (allowed.ok && allowed.data?.mode !== 'live') {
    notes.push(`Allowlisted user returned mode=${allowed.data?.mode}; to test LIVE gating you must deploy with STRIPE_MODE=live.`);
  }

  if (notes.length) {
    console.log('⚠️  Notes:');
    for (const n of notes) console.log(`- ${n}`);
  } else {
    console.log('✅ Script completed. Interpret results against your runtimeFlags expectations.');
  }

  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Fatal:', e);
  process.exit(1);
});
