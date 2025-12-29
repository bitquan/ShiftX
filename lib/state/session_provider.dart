import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../core/constants.dart';
import '../models/app_user.dart';
import '../services/auth_service.dart';
import '../services/user_service.dart';
import '../services/driver_service.dart';

class SessionProvider extends ChangeNotifier {
  final AuthService auth;
  final UserService users;
  final DriverService drivers;

  SessionProvider({
    required this.auth,
    required this.users,
    required this.drivers,
  });

  User? firebaseUser;
  AppUser? appUser;

  StreamSubscription<User?>? _authSub;
  StreamSubscription<AppUser?>? _userSub;

  bool get isReady => firebaseUser != null && appUser != null;

  Future<void> init() async {
    _authSub?.cancel();
    _authSub = auth.authStateChanges().listen((u) async {
      firebaseUser = u;
      appUser = null;
      _userSub?.cancel();

      if (u == null) {
        notifyListeners();
        return;
      }

      // Default behavior: create rider user doc unless user chooses driver mode.
      await users.ensureUserDoc(uid: u.uid, role: AppConstants.roleRider);

      _userSub = users.watchUser(u.uid).listen((userDoc) {
        appUser = userDoc;
        notifyListeners();
      });
    });
  }

  Future<void> signInAnonAsRider() async {
    final res = await auth.signInAnon();
    if (!res.isOk) throw Exception(res.error);
    // user doc ensured by init listener
  }

  Future<void> switchToDriverModeSolo() async {
    final u = auth.currentUser;
    if (u == null) throw Exception('Not signed in.');
    await users.setRole(u.uid, AppConstants.roleDriver);
    await drivers.ensureDriverDoc(u.uid);
  }

  Future<void> signOut() async {
    await auth.signOut();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _userSub?.cancel();
    super.dispose();
  }
}
