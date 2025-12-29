import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_provider.dart';
import 'rider_request_screen.dart';

class RiderHomeScreen extends StatelessWidget {
  const RiderHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('shiftX — Rider'),
        actions: [
          IconButton(
            onPressed: () => session.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text(
              'Rider Home (MVP)',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const RiderRequestScreen(),
                    ),
                  );
                },
                child: const Text('Request a Ride'),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Maps + live tracking come next.\nFor now this proves the request → accept → ride lifecycle.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
