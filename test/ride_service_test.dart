// Test: ride_service_test.dart
// Purpose: Smoke tests for `RideService` verifying callable invocation and error mapping.
// When to update: Update tests when callable names, parameters, or error semantics change.

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shiftx/services/ride_service.dart';

class MockFunctionsClient extends Mock implements FunctionsClient {}

void main() {
  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  group('RideService (callables)', () {
    late MockFunctionsClient mockFunctions;
    late RideService service;

    setUp(() {
      mockFunctions = MockFunctionsClient();
      service = RideService(functionsClient: mockFunctions);
    });

    test('acceptRide calls function with rideId', () async {
      when(
        () => mockFunctions.call('acceptRide', {'rideId': 'r1'}),
      ).thenAnswer((_) async {});

      await service.acceptRide(rideId: 'r1');

      verify(
        () => mockFunctions.call('acceptRide', {'rideId': 'r1'}),
      ).called(1);
    });

    test('acceptRide maps unauthenticated to UnauthorizedException', () async {
      when(
        () => mockFunctions.call('acceptRide', any()),
      ).thenThrow(Exception('unauthenticated'));

      expect(
        () => service.acceptRide(rideId: 'r1'),
        throwsA(isA<UnauthorizedException>()),
      );
    });

    test('start -> complete sequence (smoke)', () async {
      when(
        () => mockFunctions.call('acceptRide', any()),
      ).thenAnswer((_) async {});
      when(
        () => mockFunctions.call('startRide', any()),
      ).thenAnswer((_) async {});
      when(
        () => mockFunctions.call('completeRide', any()),
      ).thenAnswer((_) async {});

      // smoke: accept, start, complete
      await service.acceptRide(rideId: 'r1');
      await service.startRide('r1');
      await service.completeRide('r1');

      verifyInOrder([
        () => mockFunctions.call('acceptRide', {'rideId': 'r1'}),
        () => mockFunctions.call('startRide', {'rideId': 'r1'}),
        () => mockFunctions.call('completeRide', {'rideId': 'r1'}),
      ]);
    });

    test(
      'cancelRide maps failed-precondition to PreconditionException',
      () async {
        when(
          () => mockFunctions.call('cancelRide', any()),
        ).thenThrow(Exception('failed-precondition'));

        expect(
          () => service.cancelRide('r1'),
          throwsA(isA<PreconditionException>()),
        );
      },
    );
  });
}
