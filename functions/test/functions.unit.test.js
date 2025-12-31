"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
require("mocha");
// Ensure tests run against emulator; set defaults if not provided
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';
let acceptRideHandler, startRideHandler, completeRideHandler;
describe('Cloud Functions unit tests', function () {
    this.timeout(10000);
    let db;
    beforeEach(async () => {
        // Import handlers after ensuring emulator env is set
        // Import compiled JS from lib/ to avoid ts-node ESM resolution issues.
        // @ts-ignore: import compiled JS build without type declarations
        const mod = await Promise.resolve().then(() => __importStar(require('../lib/index.js')));
        acceptRideHandler = mod.acceptRideHandler;
        startRideHandler = mod.startRideHandler;
        completeRideHandler = mod.completeRideHandler;
        // Initialize admin (should connect to the emulator via env var)
        try {
            if (!(0, app_1.getApps)().length)
                (0, app_1.initializeApp)({ projectId: process.env.GCLOUD_PROJECT });
        }
        catch (e) {
            // already initialized
        }
        db = (0, firestore_1.getFirestore)();
        // clear collections
        const rides = await db.collection('rides').listDocuments();
        await Promise.all(rides.map((d) => d.delete()));
        const drivers = await db.collection('drivers').listDocuments();
        await Promise.all(drivers.map((d) => d.delete()));
    });
    it('happy path: accept -> start -> complete', async () => {
        // seed driver and ride
        await db.collection('drivers').doc('driver1').set({ isBusy: false });
        await db.collection('rides').doc('ride1').set({ riderId: 'r1', status: 'requested' });
        const ctx = { auth: { uid: 'driver1' } };
        const res1 = await acceptRideHandler({ rideId: 'ride1' }, ctx, db);
        (0, chai_1.expect)(res1).to.deep.equal({ ok: true });
        const rideSnap = await db.collection('rides').doc('ride1').get();
        const ride = rideSnap.data();
        (0, chai_1.expect)(ride.status).to.equal('accepted');
        (0, chai_1.expect)(ride.driverId).to.equal('driver1');
        const res2 = await startRideHandler({ rideId: 'ride1' }, ctx, db);
        (0, chai_1.expect)(res2).to.deep.equal({ ok: true });
        const started = (await db.collection('rides').doc('ride1').get()).data();
        (0, chai_1.expect)(started.status).to.equal('started');
        const res3 = await completeRideHandler({ rideId: 'ride1' }, ctx, db);
        (0, chai_1.expect)(res3).to.deep.equal({ ok: true });
        const completed = (await db.collection('rides').doc('ride1').get()).data();
        (0, chai_1.expect)(completed.status).to.equal('completed');
        const driver = (await db.collection('drivers').doc('driver1').get()).data();
        (0, chai_1.expect)(driver.isBusy).to.equal(false);
    });
    it('double-accept concurrency: only one driver wins', async () => {
        // seed two drivers and one ride
        await db.collection('drivers').doc('d1').set({ isBusy: false });
        await db.collection('drivers').doc('d2').set({ isBusy: false });
        await db.collection('rides').doc('r1').set({ riderId: 'r', status: 'requested' });
        const ctx1 = { auth: { uid: 'd1' } };
        const ctx2 = { auth: { uid: 'd2' } };
        // Run both accept attempts in parallel
        const p1 = acceptRideHandler({ rideId: 'r1' }, ctx1, db).then(() => ({ ok: true, driver: 'd1' })).catch((e) => ({ ok: false, err: e, driver: 'd1' }));
        const p2 = acceptRideHandler({ rideId: 'r1' }, ctx2, db).then(() => ({ ok: true, driver: 'd2' })).catch((e) => ({ ok: false, err: e, driver: 'd2' }));
        const results = await Promise.all([p1, p2]);
        // ensure the failed result has the expected HttpsError code
        const failed = results.find(r => !r.ok);
        (0, chai_1.expect)(failed).to.exist;
        const fe = failed.err;
        (0, chai_1.expect)(fe).to.have.property('code');
        (0, chai_1.expect)(['failed-precondition', 'aborted', 'already-exists']).to.include(fe.code);
        const successes = results.filter(r => r.ok);
        const fails = results.filter(r => !r.ok);
        (0, chai_1.expect)(successes.length).to.equal(1);
        (0, chai_1.expect)(fails.length).to.equal(1);
        // verify driver doc states
        const d1 = (await db.collection('drivers').doc('d1').get()).data();
        const d2 = (await db.collection('drivers').doc('d2').get()).data();
        const ride = (await db.collection('rides').doc('r1').get()).data();
        const winner = successes[0].driver;
        (0, chai_1.expect)(ride.driverId).to.equal(winner);
        (0, chai_1.expect)([d1.isBusy, d2.isBusy].filter(Boolean).length).to.equal(1);
    });
    it('auth enforcement: unauthenticated accept fails', async () => {
        await db.collection('drivers').doc('d1').set({ isBusy: false });
        await db.collection('rides').doc('r2').set({ riderId: 'r', status: 'requested' });
        const ctx = { auth: null };
        try {
            await acceptRideHandler({ rideId: 'r2' }, ctx, db);
            throw new Error('expected unauthenticated');
        }
        catch (e) {
            (0, chai_1.expect)(e).to.have.property('code', 'unauthenticated');
        }
    });
    it('invalid transitions fail (start before accept)', async () => {
        await db.collection('drivers').doc('d3').set({ isBusy: false });
        await db.collection('rides').doc('r3').set({ riderId: 'r', status: 'requested' });
        const ctx = { auth: { uid: 'd3' } };
        try {
            await startRideHandler({ rideId: 'r3' }, ctx, db);
            throw new Error('expected failed-precondition');
        }
        catch (e) {
            (0, chai_1.expect)(e).to.have.property('code', 'failed-precondition');
        }
    });
});
//# sourceMappingURL=functions.unit.test.js.map