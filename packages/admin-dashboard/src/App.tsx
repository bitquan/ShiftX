import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AuthGate } from './components/AuthGate';
import { Dashboard } from './components/Dashboard';
import { ProdDiagnostics } from './components/ProdDiagnostics';
import './styles.css';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[Auth] State changed:', user ? user.email : 'No user');
      setUser(user);
      
      if (user) {
        // Check if user is admin
        try {
          console.log('[Auth] Checking admin status for UID:', user.uid);
          const adminConfigRef = doc(db, 'config', 'admins');
          const adminConfigSnap = await getDoc(adminConfigRef);
          
          console.log('[Auth] Admin config exists:', adminConfigSnap.exists());
          
          if (adminConfigSnap.exists()) {
            const adminUids = adminConfigSnap.data()?.uids || [];
            console.log('[Auth] Admin UIDs:', adminUids);
            const userIsAdmin = adminUids.includes(user.uid);
            console.log('[Auth] User is admin:', userIsAdmin);
            setIsAdmin(userIsAdmin);
            
            if (!userIsAdmin) {
              // Not an admin - sign them out
              console.warn('[Auth] Not an admin, signing out');
              await signOut(auth);
              alert('Access denied: Admin privileges required');
            }
          } else {
            console.warn('[Auth] Admin config document not found');
            setIsAdmin(false);
            await signOut(auth);
            alert('Access denied: No admin configuration found');
          }
        } catch (error: any) {
          console.error('[Auth] Error checking admin status:', error);
          console.error('[Auth] Error code:', error.code);
          console.error('[Auth] Error message:', error.message);
          
          // If it's a permission error, just sign them out quietly
          // Don't cascade errors
          setIsAdmin(false);
          if (user) {
            await signOut(auth).catch(e => console.error('[Auth] Sign out failed:', e));
          }
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <>
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
        <ProdDiagnostics />
      </>
    );
  }

  if (!user || !isAdmin) {
    return (
      <>
        <AuthGate />
        <ProdDiagnostics />
      </>
    );
  }

  return (
    <>
      <Dashboard />
      <ProdDiagnostics />
    </>
  );
}
