// Service: RideService
// Purpose: Client-side wrapper for ride-related server operations (accept/start/complete/cancel)
// When to update: Update this file when the callable names or parameters change, or when error mappings need to be extended.

import 'package:cloud_firestore/cloud_firestore.dart';
// Note: We purposely avoid a hard dependency on `firebase_functions` here so
// unit tests can compile without requiring a specific version of the package.
// If you want a concrete implementation that talks to Firebase, create
// `lib/services/functions_client_firebase.dart` that implements
// `FunctionsClient` using the `firebase_functions` package and inject it.
import '../core/constants.dart';
import '../models/ride.dart';

// Domain exceptions for ride operations
class RideException implements Exception {
  final String message;
  RideException(this.message);
  @override
  String toString() => 'RideException: $message';
}

class UnauthorizedException extends RideException {
  UnauthorizedException(super.message);
}

class PreconditionException extends RideException {
  PreconditionException(super.message);
}

class NotFoundException extends RideException {
  NotFoundException(super.message);
}

// Abstraction over Firebase Functions to make testing simple and explicit.
abstract class FunctionsClient {
  Future<void> call(String name, Map<String, dynamic> data);
}

// Lightweight default implementation used when no real `firebase_functions`
// package is available at compile-time. This avoids compilation issues in CI
// and for contributors who don't want to depend on a specific package
// version. For real usage, add `lib/services/functions_client_firebase.dart`
// that imports `package:firebase_functions/firebase_functions.dart` and
// implements `FunctionsClient` by delegating to the real SDK.
class FunctionsClientImpl implements FunctionsClient {
  final dynamic _delegate;

  FunctionsClientImpl({dynamic delegate}) : _delegate = delegate;

  @override
  Future<void> call(String name, Map<String, dynamic> data) async {
    if (_delegate != null) {
      return await _delegate(name, data);
    }

    throw UnsupportedError(
      'No Functions implementation available. Inject a FunctionsClient (e.g. a Firebase-backed implementation or a test double).',
    );
  }
}

class RideService {
  final FirebaseFirestore? _firestore;
  FirebaseFirestore get _db => _firestore ?? FirebaseFirestore.instance;

  final FunctionsClient _functionsClient;

  // Allow dependency injection for easy testing.
  // Provide `firestore` in tests to avoid `Firebase.initializeApp()` calls.
  RideService({FunctionsClient? functionsClient, FirebaseFirestore? firestore})
    : _functionsClient = functionsClient ?? FunctionsClientImpl(),
      _firestore = firestore;

  CollectionReference<Map<String, dynamic>> get _rides =>
      _db.collection('rides');

  Stream<Ride?> watchRide(String rideId) {
    return _rides.doc(rideId).snapshots().map((snap) {
      if (!snap.exists) return null;
      final data = snap.data();
      if (data == null) return null;
      return Ride.fromMap(snap.id, data);
    });
  }

  Stream<List<Ride>> watchIncomingRequestedRides() {
    // For solo driver: show any requested rides
    return _rides
        .where('status', isEqualTo: AppConstants.rideRequested)
        .orderBy('createdAtMs', descending: true)
        .limit(10)
        .snapshots()
        .map((q) => q.docs.map((d) => Ride.fromMap(d.id, d.data())).toList());
  }

  Future<String> createRideRequest({
    required String riderId,
    required Map<String, dynamic> pickup,
    required Map<String, dynamic> dropoff,
    required int priceCents,
  }) async {
    final doc = await _rides.add({
      'riderId': riderId,
      'driverId': null,
      'pickup': pickup,
      'dropoff': dropoff,
      'status': AppConstants.rideRequested,
      'priceCents': priceCents,
      'createdAtMs': DateTime.now().millisecondsSinceEpoch,
    });

    // SOLO DRIVER AUTO-ASSIGN (MVP)
    final driverId = 'YOUR_DRIVER_UID_HERE';

    await _rides.doc(doc.id).update({
      'driverId': driverId,
      'status': AppConstants.rideAccepted,
    });

    return doc.id;
  }

  Future<void> acceptRide({required String rideId}) async {
    try {
      await _functionsClient.call('acceptRide', {'rideId': rideId});
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('unauthenticated')) {
        throw UnauthorizedException('User must be signed in');
      }
      if (msg.contains('not-found')) throw NotFoundException('Ride not found');
      if (msg.contains('failed-precondition')) {
        throw PreconditionException('Ride not available');
      }
      rethrow;
    }
  }

  Future<void> startRide(String rideId) async {
    try {
      await _functionsClient.call('startRide', {'rideId': rideId});
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('unauthenticated')) {
        throw UnauthorizedException('User must be signed in');
      }
      if (msg.contains('not-found')) throw NotFoundException('Ride not found');
      if (msg.contains('failed-precondition')) {
        throw PreconditionException('Ride cannot be started');
      }
      rethrow;
    }
  }

  Future<void> completeRide(String rideId) async {
    try {
      await _functionsClient.call('completeRide', {'rideId': rideId});
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('unauthenticated')) {
        throw UnauthorizedException('User must be signed in');
      }
      if (msg.contains('not-found')) throw NotFoundException('Ride not found');
      if (msg.contains('failed-precondition')) {
        throw PreconditionException('Ride cannot be completed');
      }
      rethrow;
    }
  }

  Future<void> cancelRide(String rideId) async {
    try {
      await _functionsClient.call('cancelRide', {'rideId': rideId});
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('unauthenticated')) {
        throw UnauthorizedException('User must be signed in');
      }
      if (msg.contains('not-found')) throw NotFoundException('Ride not found');
      if (msg.contains('failed-precondition')) {
        throw PreconditionException('Ride cannot be cancelled');
      }
      rethrow;
    }
  }
}
