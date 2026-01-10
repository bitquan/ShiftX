import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Error boundary for Firestore stream listeners
/// Catches common Firestore errors and displays stable UI instead of crashing
class FirestoreStreamBuilder<T> extends StatelessWidget {
  final Stream<T> stream;
  final Widget Function(BuildContext context, T data) builder;
  final Widget Function(BuildContext context)? loadingBuilder;
  final Widget Function(BuildContext context, Object error)? errorBuilder;
  final String? errorMessage;

  const FirestoreStreamBuilder({
    super.key,
    required this.stream,
    required this.builder,
    this.loadingBuilder,
    this.errorBuilder,
    this.errorMessage,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<T>(
      stream: stream,
      builder: (context, snapshot) {
        // Handle errors gracefully
        if (snapshot.hasError) {
          final error = snapshot.error!;

          // Log error for debugging
          debugPrint('Firestore stream error: $error');

          // Use custom error builder if provided
          if (errorBuilder != null) {
            return errorBuilder!(context, error);
          }

          // Default error handling
          String displayMessage = errorMessage ?? _getErrorMessage(error);

          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    displayMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () {
                      // Try to pop back if possible
                      if (Navigator.canPop(context)) {
                        Navigator.pop(context);
                      }
                    },
                    icon: const Icon(Icons.arrow_back),
                    label: const Text('Go Back'),
                  ),
                ],
              ),
            ),
          );
        }

        // Loading state
        if (!snapshot.hasData) {
          if (loadingBuilder != null) {
            return loadingBuilder!(context);
          }
          return const Center(child: CircularProgressIndicator());
        }

        // Success - build with data
        return builder(context, snapshot.data as T);
      },
    );
  }

  /// Get user-friendly error message based on error type
  String _getErrorMessage(Object error) {
    // Handle FirebaseException specifically
    if (error is FirebaseException) {
      switch (error.code) {
        case 'permission-denied':
          return 'You don\'t have permission to access this data';
        case 'unavailable':
          return 'Service temporarily unavailable. Please try again';
        case 'cancelled':
          return 'Request was cancelled';
        case 'deadline-exceeded':
          return 'Request timed out. Please check your connection';
        case 'not-found':
          return 'The requested data was not found';
        case 'already-exists':
          return 'This data already exists';
        case 'resource-exhausted':
          return 'Service quota exceeded. Please try again later';
        case 'failed-precondition':
          return 'Operation cannot be performed at this time';
        case 'aborted':
          return 'Operation was aborted. Please try again';
        case 'out-of-range':
          return 'Invalid data range';
        case 'unimplemented':
          return 'Feature not implemented';
        case 'internal':
          return 'Internal server error. Please try again';
        case 'data-loss':
          return 'Data corruption detected';
        case 'unauthenticated':
          return 'Authentication required';
        default:
          return 'Connection error: ${error.message ?? error.code}';
      }
    }

    // Generic error fallback
    return 'Connection error. Please try again';
  }
}

/// Convenience wrapper for nullable data streams
class FirestoreStreamBuilderNullable<T> extends StatelessWidget {
  final Stream<T?> stream;
  final Widget Function(BuildContext context, T data) builder;
  final Widget Function(BuildContext context)? loadingBuilder;
  final Widget Function(BuildContext context, Object error)? errorBuilder;
  final Widget Function(BuildContext context)? nullBuilder;
  final String? errorMessage;

  const FirestoreStreamBuilderNullable({
    super.key,
    required this.stream,
    required this.builder,
    this.loadingBuilder,
    this.errorBuilder,
    this.nullBuilder,
    this.errorMessage,
  });

  @override
  Widget build(BuildContext context) {
    return FirestoreStreamBuilder<T?>(
      stream: stream,
      errorMessage: errorMessage,
      errorBuilder: errorBuilder,
      loadingBuilder: loadingBuilder,
      builder: (context, data) {
        if (data == null) {
          if (nullBuilder != null) {
            return nullBuilder!(context);
          }
          return const Center(child: Text('No data available'));
        }
        return builder(context, data);
      },
    );
  }
}
