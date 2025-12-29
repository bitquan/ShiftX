import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/ride_service.dart';
import '../../core/constants.dart';

class RiderWaitingScreen extends StatelessWidget {
  final String rideId;
  const RiderWaitingScreen({super.key, required this.rideId});

  @override
  Widget build(BuildContext context) {
    final rides = context.read<RideService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Waiting for Driver')),
      body: StreamBuilder(
        stream: rides.watchRide(rideId),
        builder: (context, snapshot) {
          final ride = snapshot.data;

          if (ride == null) {
            return const Center(child: CircularProgressIndicator());
          }

          final status = ride.status;
          final statusText = switch (status) {
            AppConstants.rideRequested => 'Searching (solo driver will accept)',
            AppConstants.rideAccepted => 'Driver accepted! On the way.',
            AppConstants.rideStarted => 'Ride started.',
            AppConstants.rideCompleted => 'Ride completed ✅',
            AppConstants.rideCancelled => 'Ride cancelled.',
            _ => status,
          };

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  statusText,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Text('Ride ID: ${ride.id}'),
                const SizedBox(height: 20),
                if (status == AppConstants.rideRequested)
                  OutlinedButton(
                    onPressed: () => rides.cancelRide(ride.id),
                    child: const Text('Cancel'),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
