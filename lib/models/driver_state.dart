class DriverState {
  final String driverId;
  final bool isOnline;
  final bool isBusy;
  final String? currentRideId;

  const DriverState({
    required this.driverId,
    required this.isOnline,
    required this.isBusy,
    this.currentRideId,
  });

  factory DriverState.fromMap(String id, Map<String, dynamic> map) {
    return DriverState(
      driverId: id,
      isOnline: (map['isOnline'] ?? false) as bool,
      isBusy: (map['isBusy'] ?? false) as bool,
      currentRideId: map['currentRideId'] as String?,
    );
  }

  Map<String, dynamic> toMap() => {
    'isOnline': isOnline,
    'isBusy': isBusy,
    'currentRideId': currentRideId,
  };
}
