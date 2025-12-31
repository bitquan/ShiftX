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
require("mocha");
const rules_unit_testing_1 = require("@firebase/rules-unit-testing");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
let setDriverOnlineHandler;
let driverHeartbeatHandler;
let acceptRideHandler;
let startRideHandler;
let completeRideHandler;
// Ensure emulator env
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';
describe('Driver lifecycle (server authoritative)', function () {
    this.timeout(10000);
    let testEnv;
    let db;
    before(async () => {
        testEnv = await (0, rules_unit_testing_1.initializeTestEnvironment)({ projectId: process.env.GCLOUD_PROJECT, firestore: { host: '127.0.0.1', port: 8080, rules: '' } });
        // import compiled functions
        // @ts-ignore: import compiled JS build without type declarations
        const mod = await Promise.resolve().then(() => __importStar(require('../lib/index.js')));
        setDriverOnlineHandler = mod.setDriverOnlineHandler;
        driverHeartbeatHandler = mod.driverHeartbeatHandler;
        acceptRideHandler = mod.acceptRideHandler;
        startRideHandler = mod.startRideHandler;
        completeRideHandler = mod.completeRideHandler;
    });
    beforeEach(async () => {
        if (!(0, app_1.getApps)().length)
            (0, app_1.initializeApp)({ projectId: process.env.GCLOUD_PROJECT });
        db = (0, firestore_1.getFirestore)();
        // clean
        const drivers = await db.collection('drivers').listDocuments();
        await Promise.all(drivers.map((d) => d.delete()));
        const rides = await db.collection('rides').listDocuments();
        await Promise.all(rides.map((d) => d.delete()));
    });
    after(async () => {
        await testEnv.cleanup();
    });
    it('driver can go online when idle and cannot go offline while busy', async () => {
        await db.collection('drivers').doc('drv1').set({ isOnline: false, isBusy: false });
        const ctx = { auth: { uid: 'drv1' } };
        const resOn = await setDriverOnlineHandler({ online: true }, ctx, db);
        (0, chai_1.expect)(resOn).to.deep.equal({ ok: true });
        const d = (await db.collection('drivers').doc('drv1').get()).data();
        (0, chai_1.expect)(d.isOnline).to.equal(true);
        // Simulate driver busy via server (admin)
        await db.collection('drivers').doc('drv1').set({ isBusy: true, currentRideId: 'r1' }, { merge: true });
        try {
            await setDriverOnlineHandler({ online: false }, ctx, db);
            throw new Error('expected failure');
        }
        catch (e) {
            (0, chai_1.expect)(e).to.have.property('code', 'failed-precondition');
        }
    });
    it('accept -> driver busy invariant and complete clears it', async () => {
        // seed
        await db.collection('drivers').doc('d1').set({ isBusy: false });
        await db.collection('rides').doc('rideX').set({ riderId: 'r', status: 'requested' });
        const ctx = { auth: { uid: 'd1' } };
        await acceptRideHandler({ rideId: 'rideX' }, ctx, db);
        let driver = (await db.collection('drivers').doc('d1').get()).data();
        (0, chai_1.expect)(driver.isBusy).to.equal(true);
        (0, chai_1.expect)(driver.currentRideId).to.equal('rideX');
        // start then complete
        await startRideHandler({ rideId: 'rideX' }, ctx, db);
        await completeRideHandler({ rideId: 'rideX' }, ctx, db);
        driver = (await db.collection('drivers').doc('d1').get()).data();
        (0, chai_1.expect)(driver.isBusy).to.equal(false);
        (0, chai_1.expect)(driver.currentRideId).to.equal(null);
    });
    it('heartbeat updates lastSeenAtMs', async () => {
        await db.collection('drivers').doc('hb1').set({ isOnline: true });
        const ctx = { auth: { uid: 'hb1' } };
        const res = await driverHeartbeatHandler({}, ctx, db);
        (0, chai_1.expect)(res).to.deep.equal({ ok: true });
        const d = (await db.collection('drivers').doc('hb1').get()).data();
        (0, chai_1.expect)(d).to.have.property('lastSeenAtMs');
    });
    it('unauthenticated calls rejected', async () => {
        const ctx = { auth: null };
        try {
            await setDriverOnlineHandler({ online: true }, ctx, db);
            throw new Error('expected unauthenticated');
        }
        catch (e) {
            (0, chai_1.expect)(e).to.have.property('code', 'unauthenticated');
        }
    });
});
//# sourceMappingURL=driver.unit.test.js.map