import React from 'react';
import './MaintenanceBanner.css';

interface MaintenanceBannerProps {
  message: string;
  type?: 'warning' | 'error' | 'info';
}

export function MaintenanceBanner({ message, type = 'warning' }: MaintenanceBannerProps) {
  if (!message) return null;

  return (
    <div className={`maintenance-banner maintenance-banner--${type}`}>
      <div className="maintenance-banner__icon">
        {type === 'error' && '⚠️'}
        {type === 'warning' && '⚡'}
        {type === 'info' && 'ℹ️'}
      </div>
      <div className="maintenance-banner__content">
        <strong>System Notice:</strong> {message}
      </div>
    </div>
  );
}
