import 'package:flutter/material.dart';
import '../../services/ride_service.dart';
import '../../services/driver_service.dart';
import '../../core/firestore_stream_builder.dart';
import 'driver_active_ride_screen.dart';

class DriverIncomingRideScreen extends StatelessWidget {
  final String driverId;
  final RideService rideService;
  final DriverService driverService;
  final bool isBusy;

  const DriverIncomingRideScreen({
    super.key,
    required this.driverId,
    required this.rideService,
    required this.driverService,
    required this.isBusy,
  });

  @override
  Widget build(BuildContext context) {
    if (isBusy) {
      return const Center(child: Text('You are busy. Finish current ride.'));
    }

    return FirestoreStreamBuilder(
      stream: rideService.watchIncomingRequestedRides(),
      errorMessage:
          'Unable to load incoming rides. Please check your connection.',
      builder: (context, rides) {
        if (rides.isEmpty) {
          return const Center(child: Text('No requests yet.'));
        }

        final ride = rides.first;

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Incoming Ride',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                Text('Price: \$${(ride.priceCents / 100).toStringAsFixed(2)}'),
                const SizedBox(height: 6),
                Text('Status: ${ride.status}'),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => rideService.cancelRide(ride.id),
                        child: const Text('Ignore'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          try {
                            await rideService.acceptRide(rideId: ride.id);

                            if (context.mounted) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => DriverActiveRideScreen(
                                    rideId: ride.id,
                                    driverId: driverId,
                                  ),
                                ),
                              );
                            }
                          } catch (_) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Ride not available'),
                                ),
                              );
                            }
                          }
                        },
                        child: const Text('Accept'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'MVP: this is the "accept flow" core.\nMaps/tracking comes next.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
