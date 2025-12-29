import 'package:flutter/material.dart';
import 'core/constants.dart';
import 'models/app_user.dart';
import 'screens/auth/login_screen.dart';
import 'screens/rider/rider_home_screen.dart';
import 'screens/driver/driver_home_screen.dart';

class ShiftXApp extends StatelessWidget {
  final AppUser? user;

  const ShiftXApp({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, brightness: Brightness.dark),
      home: _homeForRole(user),
    );
  }

  Widget _homeForRole(AppUser? u) {
    if (u == null) return const LoginScreen();
    if (u.role == AppConstants.roleDriver) return const DriverHomeScreen();
    return const RiderHomeScreen();
  }
}
