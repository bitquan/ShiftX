import React from 'react';
import './menuButton.css';

interface MenuButtonProps {
  onClick: () => void;
  'aria-label'?: string;
}

export function MenuButton({ onClick, 'aria-label': ariaLabel }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="menu-button"
      aria-label={ariaLabel || 'Open menu'}
      type="button"
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
    </button>
  );
}
