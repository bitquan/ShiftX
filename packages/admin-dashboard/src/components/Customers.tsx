import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Customer {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  savedPlaces?: {
    home?: { address: string; lat: number; lng: number };
    work?: { address: string; lat: number; lng: number };
  };
  ridesCount?: number;
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const customersSnap = await getDocs(collection(db, 'customers'));
      const usersSnap = await getDocs(collection(db, 'users'));
      
      const usersMap = new Map();
      usersSnap.docs.forEach(doc => {
        usersMap.set(doc.id, doc.data());
      });

      const customersData: Customer[] = customersSnap.docs.map(doc => {
        const customerData = doc.data();
        const userData = usersMap.get(doc.id) || {};
        
        return {
          uid: doc.id,
          email: userData.email || customerData.email || '',
          displayName: userData.displayName || userData.email?.split('@')[0] || 'Unknown',
          photoURL: userData.photoURL,
          phoneNumber: userData.phoneNumber,
          savedPlaces: customerData.savedPlaces,
          ridesCount: 0, // Could be calculated from rides collection
        };
      });

      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
      alert('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const searchLower = search.toLowerCase();
    return (
      customer.displayName.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <div className="loading">Loading customers...</div>;
  }

  return (
    <div className="customers-screen">
      <div className="screen-header">
        <h2>Customers</h2>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="customers-list">
        {filteredCustomers.length === 0 ? (
          <div className="empty-state">No customers found</div>
        ) : (
          filteredCustomers.map(customer => (
            <div key={customer.uid} className="customer-card">
              <div className="customer-info">
                {customer.photoURL ? (
                  <img src={customer.photoURL} alt={customer.displayName} className="customer-photo" />
                ) : (
                  <div className="customer-photo-placeholder">
                    {customer.displayName.charAt(0)}
                  </div>
                )}
                
                <div className="customer-details">
                  <div className="customer-name">{customer.displayName}</div>
                  <div className="customer-email">{customer.email}</div>
                  {customer.phoneNumber && (
                    <div className="customer-phone">{customer.phoneNumber}</div>
                  )}
                  
                  {customer.savedPlaces && (
                    <div className="saved-places">
                      {customer.savedPlaces.home && (
                        <div className="saved-place">
                          🏠 Home: {customer.savedPlaces.home.address}
                        </div>
                      )}
                      {customer.savedPlaces.work && (
                        <div className="saved-place">
                          💼 Work: {customer.savedPlaces.work.address}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
