import React from 'react';
import './driverHeader.css';
import { NavItem } from './SideSheet';

interface DriverHeaderProps {
  activeTab: NavItem;
  onNavigateBack: () => void;
  onOpenMenu: () => void;
}

export function DriverHeader({ activeTab, onNavigateBack, onOpenMenu }: DriverHeaderProps) {
  const isHome = activeTab === 'home';

  return (
    <header className="driver-header">
      <div className="driver-header-content">
        {/* Left button: Back or Menu */}
        {isHome ? (
          <button
            onClick={onOpenMenu}
            className="driver-header-button"
            aria-label="Open menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span className="driver-header-button-label">Menu</span>
          </button>
        ) : (
          <button
            onClick={onNavigateBack}
            className="driver-header-button"
            aria-label="Go back"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="driver-header-button-label">Back</span>
          </button>
        )}

        {/* Center title */}
        <h1 className="driver-header-title">
          {activeTab === 'home' && 'Map'}
          {activeTab === 'rides' && 'Ride History'}
          {activeTab === 'wallet' && 'Wallet'}
          {activeTab === 'profile' && 'Profile'}
        </h1>

        {/* Right spacer for balance */}
        <div className="driver-header-spacer" />
      </div>
    </header>
  );
}
