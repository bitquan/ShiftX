import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/ride_service.dart';
import '../../core/constants.dart';
import '../../core/firestore_stream_builder.dart';

class DriverActiveRideScreen extends StatelessWidget {
  final String rideId;
  final String driverId;

  const DriverActiveRideScreen({
    super.key,
    required this.rideId,
    required this.driverId,
  });

  @override
  Widget build(BuildContext context) {
    final rides = context.read<RideService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Active Ride')),
      body: FirestoreStreamBuilderNullable(
        stream: rides.watchRide(rideId),
        errorMessage:
            'Unable to load ride details. Please check your connection.',
        builder: (context, ride) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  'Status: ${ride.status}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                Text('Payout: \$${(ride.priceCents / 100).toStringAsFixed(2)}'),
                const SizedBox(height: 24),
                if (ride.status == AppConstants.rideAccepted)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async => await rides.startRide(rideId),
                      child: const Text('Start Ride'),
                    ),
                  ),
                if (ride.status == AppConstants.rideStarted)
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        await rides.completeRide(rideId);
                        if (context.mounted) Navigator.pop(context);
                      },
                      child: const Text('End Ride'),
                    ),
                  ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () async {
                    await rides.cancelRide(rideId);
                    if (context.mounted) Navigator.pop(context);
                  },
                  child: const Text('Cancel Ride'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
