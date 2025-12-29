class Ride {
  final String id;
  final String riderId;
  final String? driverId;

  final Map<String, dynamic>
  pickup; // { "label": "...", "lat": 0.0, "lng": 0.0 }
  final Map<String, dynamic> dropoff; // same shape

  final String status; // requested | accepted | started | completed | cancelled
  final int priceCents;

  final DateTime createdAt;

  const Ride({
    required this.id,
    required this.riderId,
    required this.pickup,
    required this.dropoff,
    required this.status,
    required this.priceCents,
    required this.createdAt,
    this.driverId,
  });

  factory Ride.fromMap(String id, Map<String, dynamic> map) {
    return Ride(
      id: id,
      riderId: map['riderId'] as String,
      driverId: map['driverId'] as String?,
      pickup: Map<String, dynamic>.from(map['pickup'] as Map),
      dropoff: Map<String, dynamic>.from(map['dropoff'] as Map),
      status: map['status'] as String,
      priceCents: (map['priceCents'] ?? 0) as int,
      createdAt: DateTime.fromMillisecondsSinceEpoch(
        (map['createdAtMs'] ?? 0) as int,
      ),
    );
  }

  Map<String, dynamic> toMap() => {
    'riderId': riderId,
    'driverId': driverId,
    'pickup': pickup,
    'dropoff': dropoff,
    'status': status,
    'priceCents': priceCents,
    'createdAtMs': createdAt.millisecondsSinceEpoch,
  };
}
