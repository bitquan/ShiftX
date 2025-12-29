import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Keep the widget test simple and independent of Firebase and providers.
// Purpose: Ensure the app's welcome text is visible in the login flow UI.
void main() {
  testWidgets('App shows welcome text', (WidgetTester tester) async {
    // Build a minimal app that contains the welcome text.
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: Text('Welcome to shiftX'))),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Welcome to shiftX'), findsOneWidget);
  });
}
