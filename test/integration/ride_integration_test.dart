import 'package:flutter_test/flutter_test.dart';
import 'package:shiftx/services/ride_service.dart';
import 'package:shiftx/services/functions_client_firebase.dart';

void main() {
  group('Integration: ride callables (emulator)', () {
    test(
      'accept/start/complete/cancel callables run on emulator',
      () async {
        final functionsClient = FunctionsClientFirebase();
        final service = RideService(functionsClient: functionsClient);

        // If Firestore emulator is not available, skip test (emulator required
        // to seed ride documents safely).
        final firestoreEmulatorHost = const String.fromEnvironment(
          'FIRESTORE_EMULATOR_HOST',
          defaultValue: '',
        );
        if (firestoreEmulatorHost.isEmpty) {
          // Skip the integration test in this environment.
          return;
        }

        // NOTE: Start the Functions & Firestore emulators before running this test.
        final rideId = 'test_ride_${DateTime.now().millisecondsSinceEpoch}';

        // Seed test ride via the helper callable (createTestRide) which is
        // available only when the emulator and Firestore emulator are running.
        await functionsClient.call('createTestRide', {
          'rideId': rideId,
          'riderId': 'test_rider',
          'priceCents': 100,
        });

        // Now perform the flow: accept -> start -> complete -> cancel
        await service.acceptRide(rideId: rideId);
        await service.startRide(rideId);
        await service.completeRide(rideId);
        await service.cancelRide(rideId);
      },
      timeout: Timeout(Duration(seconds: 30)),
    );
  });
}
