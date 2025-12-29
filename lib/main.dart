import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'app.dart';

import 'services/auth_service.dart';
import 'services/user_service.dart';
import 'services/driver_service.dart';
import 'services/ride_service.dart';
import 'state/session_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Dev-only: enable local emulators when started via the "Dev (With Emulators)" launch config
  final useEmulators =
      const String.fromEnvironment('USE_EMULATORS', defaultValue: '') == 'true';
  if (useEmulators) {
    // Firestore emulator
    FirebaseFirestore.instance.useFirestoreEmulator('localhost', 8080);
  }

  runApp(const ShiftXRoot());
}

class ShiftXRoot extends StatelessWidget {
  const ShiftXRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => AuthService()),
        Provider(create: (_) => UserService()),
        Provider(create: (_) => DriverService()),
        Provider(create: (_) => RideService()),
        ChangeNotifierProvider(
          create: (ctx) {
            final sp = SessionProvider(
              auth: ctx.read<AuthService>(),
              users: ctx.read<UserService>(),
              drivers: ctx.read<DriverService>(),
            );
            sp.init();
            return sp;
          },
        ),
      ],
      child: Consumer<SessionProvider>(
        builder: (context, session, child) => ShiftXApp(user: session.appUser),
      ),
    );
  }
}
