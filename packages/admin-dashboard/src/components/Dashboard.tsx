import { useState } from 'react';
import { Overview } from './Overview';
import { Drivers } from './Drivers';
import { Customers } from './Customers';
import { Rides } from './Rides';
import { AdminLogs } from './AdminLogs';
import { ErrorLogs } from './ErrorLogs';
import { RuntimeFlags } from './RuntimeFlags';
import { Reports } from './Reports';
import { PaymentsAudit } from './PaymentsAudit';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

type Screen = 'overview' | 'drivers' | 'customers' | 'rides' | 'payments-audit' | 'admin-logs' | 'error-logs' | 'runtime-flags' | 'reports';

export function Dashboard() {
  const [activeScreen, setActiveScreen] = useState<Screen>('overview');

  const handleSignOut = async () => {
    if (window.confirm('Sign out of admin dashboard?')) {
      await signOut(auth);
    }
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🛡️ ShiftX Admin</h1>
        </div>
        
        <div className="nav-links">
          <button
            className={activeScreen === 'overview' ? 'active' : ''}
            onClick={() => setActiveScreen('overview')}
          >
            📊 Overview
          </button>
          <button
            className={activeScreen === 'drivers' ? 'active' : ''}
            onClick={() => setActiveScreen('drivers')}
          >
            🚗 Drivers
          </button>
          <button
            className={activeScreen === 'customers' ? 'active' : ''}
            onClick={() => setActiveScreen('customers')}
          >
            👤 Customers
          </button>
          <button
            className={activeScreen === 'rides' ? 'active' : ''}
            onClick={() => setActiveScreen('rides')}
          >
            🚀 Rides
          </button>
          <button
            className={activeScreen === 'payments-audit' ? 'active' : ''}
            onClick={() => setActiveScreen('payments-audit')}
          >
            💳 Payments Audit
          </button>
          <button
            className={activeScreen === 'admin-logs' ? 'active' : ''}
            onClick={() => setActiveScreen('admin-logs')}
          >
            📝 Admin Logs
          </button>
          <button
            className={activeScreen === 'error-logs' ? 'active' : ''}
            onClick={() => setActiveScreen('error-logs')}
          >
            🐛 Error Logs
          </button>
          <button
            className={activeScreen === 'runtime-flags' ? 'active' : ''}
            onClick={() => setActiveScreen('runtime-flags')}
          >
            ⚡ Runtime Flags
          </button>
          <button
            className={activeScreen === 'reports' ? 'active' : ''}
            onClick={() => setActiveScreen('reports')}
          >
            ⚠️ Reports
          </button>
        </div>

        <button className="sign-out-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </nav>

      <div className="dashboard-content">
        {activeScreen === 'overview' && <Overview />}
        {activeScreen === 'drivers' && <Drivers />}
        {activeScreen === 'customers' && <Customers />}
        {activeScreen === 'rides' && <Rides />}
        {activeScreen === 'payments-audit' && <PaymentsAudit />}
        {activeScreen === 'admin-logs' && <AdminLogs />}
        {activeScreen === 'error-logs' && <ErrorLogs />}
        {activeScreen === 'runtime-flags' && <RuntimeFlags />}
        {activeScreen === 'reports' && <Reports />}
      </div>
    </div>
  );
}
