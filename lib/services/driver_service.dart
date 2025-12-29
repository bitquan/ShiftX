import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/driver_state.dart';

class DriverService {
  final _db = FirebaseFirestore.instance;

  DocumentReference<Map<String, dynamic>> driverRef(String driverId) =>
      _db.collection('drivers').doc(driverId);

  Stream<DriverState?> watchDriverState(String driverId) {
    return driverRef(driverId).snapshots().map((snap) {
      if (!snap.exists) return null;
      final data = snap.data();
      if (data == null) return null;
      return DriverState.fromMap(snap.id, data);
    });
  }

  Future<void> ensureDriverDoc(String driverId) async {
    await driverRef(driverId).set({
      'isOnline': false,
      'isBusy': false,
      'currentRideId': null,
      'updatedAtMs': DateTime.now().millisecondsSinceEpoch,
    }, SetOptions(merge: true));
  }

  Future<void> setOnline(String driverId, bool online) async {
    await driverRef(driverId).set({
      'isOnline': online,
      'updatedAtMs': DateTime.now().millisecondsSinceEpoch,
    }, SetOptions(merge: true));
  }

  Future<void> setBusy(String driverId, bool busy, {String? rideId}) async {
    await driverRef(driverId).set({
      'isBusy': busy,
      'currentRideId': rideId,
      'updatedAtMs': DateTime.now().millisecondsSinceEpoch,
    }, SetOptions(merge: true));
  }
}
