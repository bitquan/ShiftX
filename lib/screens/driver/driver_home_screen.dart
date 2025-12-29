import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/session_provider.dart';
import '../../services/driver_service.dart';
import '../../services/ride_service.dart';
import 'driver_incoming_ride_screen.dart';

class DriverHomeScreen extends StatelessWidget {
  const DriverHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final drivers = context.read<DriverService>();
    final rides = context.read<RideService>();
    final uid = session.firebaseUser?.uid;

    if (uid == null) {
      return const Scaffold(body: Center(child: Text('Not signed in')));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('shiftX — Driver (Solo)'),
        actions: [
          IconButton(
            onPressed: () => session.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: StreamBuilder(
        stream: drivers.watchDriverState(uid),
        builder: (context, snapshot) {
          final state = snapshot.data;

          if (state == null) {
            // ensure driver doc exists
            drivers.ensureDriverDoc(uid);
            return const Center(child: CircularProgressIndicator());
          }

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  value: state.isOnline,
                  title: const Text('Online'),
                  onChanged: (v) => drivers.setOnline(uid, v),
                ),
                const SizedBox(height: 10),
                if (!state.isOnline)
                  const Text('Go online to see ride requests.')
                else
                  Expanded(
                    child: DriverIncomingRideScreen(
                      driverId: uid,
                      rideService: rides,
                      driverService: drivers,
                      isBusy: state.isBusy,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
