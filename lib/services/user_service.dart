import 'package:cloud_firestore/cloud_firestore.dart';
import '../core/constants.dart';
import '../models/app_user.dart';

class UserService {
  final _db = FirebaseFirestore.instance;

  DocumentReference<Map<String, dynamic>> userRef(String uid) =>
      _db.collection('users').doc(uid);

  Stream<AppUser?> watchUser(String uid) {
    return userRef(uid).snapshots().map((snap) {
      if (!snap.exists) return null;
      final data = snap.data();
      if (data == null) return null;
      return AppUser.fromMap(snap.id, data);
    });
  }

  Future<void> ensureUserDoc({
    required String uid,
    required String role,
    String? name,
  }) async {
    final ref = userRef(uid);

    await ref.set({
      'role': role,
      'name': name,
      'createdAtMs': DateTime.now().millisecondsSinceEpoch,
    }, SetOptions(merge: true));
  }

  Future<void> setRole(String uid, String role) async {
    await userRef(uid).set({'role': role}, SetOptions(merge: true));
  }

  /// For solo-driver mode:
  /// - Your driver account should have role=driver (or admin+driver pattern later).
  Future<void> bootstrapSoloDriver(String uid) async {
    await ensureUserDoc(uid: uid, role: AppConstants.roleDriver);
  }
}
