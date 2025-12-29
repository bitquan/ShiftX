import 'package:flutter_test/flutter_test.dart';
import 'package:shiftx/services/ride_service.dart';
import 'package:shiftx/services/functions_client_firebase.dart';

void main() {
  group('Integration: failure cases (emulator)', () {
    test(
      'starting a requested ride (without accept) fails',
      () async {
        final functionsClient = FunctionsClientFirebase();
        final service = RideService(functionsClient: functionsClient);

        // This integration test requires Functions + Firestore emulators running.
        final firestoreEmulatorHost = const String.fromEnvironment(
          'FIRESTORE_EMULATOR_HOST',
          defaultValue: '',
        );
        if (firestoreEmulatorHost.isEmpty) return;

        final rideId = 'test_fail_${DateTime.now().millisecondsSinceEpoch}';

        await functionsClient.call('createTestRide', {
          'rideId': rideId,
          'riderId': 'test_rider',
          'priceCents': 100,
        });

        // Starting without accepting should fail (precondition)
        expect(() => service.startRide(rideId), throwsA(isA<Exception>()));
      },
      timeout: Timeout(Duration(seconds: 20)),
    );
  });
}
