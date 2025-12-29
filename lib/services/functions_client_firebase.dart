// HTTP-based callable client for use with the Functions emulator (and optionally production HTTP endpoints).
// This avoids a compile-time dependency on the `firebase_functions` package and works reliably for emulator integration tests.
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'ride_service.dart';

class FunctionsClientFirebase implements FunctionsClient {
  /// Base URL for callable functions. Defaults to the local emulator base.
  final String baseUrl;

  FunctionsClientFirebase({String? baseUrl})
    : baseUrl = baseUrl ?? 'http://127.0.0.1:5001/demo-no-project/us-central1';

  @override
  Future<void> call(String name, Map<String, dynamic> data) async {
    final url = Uri.parse('$baseUrl/$name');
    final body = json.encode({'data': data});
    final res = await http.post(
      url,
      body: body,
      headers: {'Content-Type': 'application/json'},
    );

    if (res.statusCode != 200) {
      // The emulator may return JSON with an "error" field; surface it.
      try {
        final jsonBody = json.decode(res.body) as Map<String, dynamic>;
        if (jsonBody.containsKey('error')) {
          final e = jsonBody['error'];
          throw Exception(e.toString());
        }
      } catch (_) {}

      throw Exception('Functions call $name failed: HTTP ${res.statusCode}');
    }

    // Successful result - nothing to return for now.
  }
}
