import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/ride_service.dart';
import '../../state/session_provider.dart';
import 'rider_waiting_screen.dart';

class RiderRequestScreen extends StatefulWidget {
  const RiderRequestScreen({super.key});

  @override
  State<RiderRequestScreen> createState() => _RiderRequestScreenState();
}

class _RiderRequestScreenState extends State<RiderRequestScreen> {
  bool loading = false;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionProvider>();
    final rides = context.read<RideService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Request Ride')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text('MVP: uses fake pickup/dropoff until maps are added.'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: loading
                    ? null
                    : () async {
                        setState(() => loading = true);
                        try {
                          final uid = session.firebaseUser!.uid;

                          // Fake locations for MVP
                          final pickup = {
                            'label': 'Pickup (MVP)',
                            'lat': 0.0,
                            'lng': 0.0,
                          };
                          final dropoff = {
                            'label': 'Dropoff (MVP)',
                            'lat': 0.0,
                            'lng': 0.0,
                          };

                          // Fake price for MVP (we’ll move to Cloud Functions later)
                          final rideId = await rides.createRideRequest(
                            riderId: uid,
                            pickup: pickup,
                            dropoff: dropoff,
                            priceCents: 1299,
                          );

                          if (mounted) {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    RiderWaitingScreen(rideId: rideId),
                              ),
                            );
                          }
                        } catch (_) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Failed to request ride'),
                              ),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => loading = false);
                        }
                      },
                child: Text(loading ? 'Requesting…' : 'Confirm Request'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
