import 'package:firebase_auth/firebase_auth.dart';
import '../core/result.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Stream<User?> authStateChanges() => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;

  Future<Result<User>> signInAnon() async {
    try {
      final cred = await _auth.signInAnonymously();
      final user = cred.user;
      if (user == null) {
        return Result.fail('No user returned from anonymous sign-in.');
      }
      return Result.ok(user);
    } catch (e) {
      return Result.fail(e.toString());
    }
  }

  Future<void> signOut() => _auth.signOut();
}
