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
const fs = __importStar(require("fs"));
const rules_unit_testing_1 = require("@firebase/rules-unit-testing");
describe('Firestore rules (rides)', function () {
    let testEnv;
    before(async () => {
        // Prefer existing FIRESTORE_EMULATOR_HOST env var (format host:port), else default to localhost:8080
        const hostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
        const [host, portStr] = hostEnv.split(':');
        const port = Number(portStr) || 8080;
        testEnv = await (0, rules_unit_testing_1.initializeTestEnvironment)({
            projectId: 'demo-no-project',
            firestore: { host, port, rules: fs.readFileSync('../firestore.rules', 'utf8') },
        });
    });
    after(async () => {
        await testEnv.cleanup();
    });
    it('allows rider to create a requested ride', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await (0, rules_unit_testing_1.assertSucceeds)(alice.collection('rides').add({
            riderId: 'alice',
            status: 'requested',
            priceCents: 100,
            pickup: { lat: 0, lng: 0 },
        }));
    });
    it('prevents rider from creating a ride with status accepted', async () => {
        const alice = testEnv.authenticatedContext('alice').firestore();
        await (0, rules_unit_testing_1.assertFails)(alice.collection('rides').add({
            riderId: 'alice',
            status: 'accepted',
            priceCents: 100,
        }));
    });
    it('prevents rider from updating status field', async () => {
        const aliceDb = testEnv.authenticatedContext('alice').firestore();
        const ref = await aliceDb.collection('rides').add({
            riderId: 'alice',
            status: 'requested',
            priceCents: 100,
        });
        await (0, rules_unit_testing_1.assertFails)(ref.update({ status: 'accepted' }));
    });
    it('prevents driver from setting driverId/status directly', async () => {
        const bobDb = testEnv.authenticatedContext('bob').firestore();
        // Simulate server creating the ride (admin) bypassing security rules
        // Create a deterministic test id and seed via admin (server-side) helper
        const id = `test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const adminDb = ctx.firestore();
            await adminDb.doc(`rides/${id}`).set({
                riderId: 'someone',
                status: 'requested',
                priceCents: 100,
            });
        });
        // driver trying to claim it should fail
        await (0, rules_unit_testing_1.assertFails)(bobDb.collection('rides').doc(id).update({ driverId: 'bob', status: 'accepted' }));
    });
    it('allows reading rides for signed in users', async () => {
        const aliceDb = testEnv.authenticatedContext('alice').firestore();
        const ref = await aliceDb.collection('rides').add({
            riderId: 'alice',
            status: 'requested',
            priceCents: 100,
        });
        await (0, rules_unit_testing_1.assertSucceeds)(aliceDb.doc(ref.path).get());
    });
});
//# sourceMappingURL=firestore.rules.test.js.map