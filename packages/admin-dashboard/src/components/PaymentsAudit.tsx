import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

interface PaymentAuditRow {
  id: string;
  paymentStatus?: string;
  stripePaymentIntentId?: string;
  paymentIntentId?: string;
  connectTransferId?: string;
  connectTransferStatus?: string;
  payoutId?: string;
  transferDestination?: string;
  paymentAuditTransferMissing?: boolean;
  updatedAtMs?: number;
}

export function PaymentsAudit() {
  const [rows, setRows] = useState<PaymentAuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRows = async () => {
    try {
      setLoading(true);
      setError('');
      const q = query(
        collection(db, 'rides'),
        orderBy('createdAtMs', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const data: PaymentAuditRow[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PaymentAuditRow[];
      setRows(data);
    } catch (err) {
      console.error('Error loading payments audit:', err);
      setError('Failed to load payments audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <div className="payments-audit-screen">
      <div className="screen-header">
        <h2>Payments Audit</h2>
        <button onClick={loadRows} disabled={loading} className="search-btn">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="audit-table">
        <div className="audit-header">
          <div>Ride ID</div>
          <div>Status</div>
          <div>PaymentIntent</div>
          <div>Transfer</div>
          <div>Payout</div>
          <div>Flags</div>
        </div>
        {rows.map((row) => {
          const paymentIntent = row.stripePaymentIntentId || row.paymentIntentId || '';
          const flags = row.paymentAuditTransferMissing ? 'Missing transfer' : '';
          return (
            <div key={row.id} className="audit-row">
              <div className="mono">{row.id}</div>
              <div>{row.paymentStatus || 'unknown'}</div>
              <div className="mono">{paymentIntent || '—'}</div>
              <div className="mono">
                {row.connectTransferId || '—'}
                {row.connectTransferStatus ? ` (${row.connectTransferStatus})` : ''}
              </div>
              <div className="mono">{row.payoutId || '—'}</div>
              <div className={flags ? 'flag warning' : 'flag'}>{flags || '—'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
