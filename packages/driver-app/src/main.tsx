import React from 'react';
import ReactDOM from 'react-dom/client';
// CRITICAL: Import firebase FIRST to ensure initialization before any component code
import './firebase';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
