class AppUser {
  final String id;
  final String? name;
  final String role; // rider | driver | admin

  const AppUser({required this.id, required this.role, this.name});

  factory AppUser.fromMap(String id, Map<String, dynamic> map) {
    return AppUser(
      id: id,
      role: (map['role'] ?? 'rider') as String,
      name: map['name'] as String?,
    );
  }

  Map<String, dynamic> toMap() => {'role': role, 'name': name};

  AppUser copyWith({String? role, String? name}) {
    return AppUser(id: id, role: role ?? this.role, name: name ?? this.name);
  }
}
