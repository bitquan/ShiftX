import { ReactNode } from 'react';
import './customerMapShell.css';

interface CustomerMapShellProps {
  mapContent: ReactNode;
  bottomSheetContent: ReactNode;
}

export function CustomerMapShell({ mapContent, bottomSheetContent }: CustomerMapShellProps) {
  return (
    <div className="customer-map-shell">
      <div className="map-layer">
        {mapContent}
      </div>
      <div className="bottom-sheet-layer">
        {bottomSheetContent}
      </div>
    </div>
  );
}
