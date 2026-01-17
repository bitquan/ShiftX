import { ReactNode, useRef, useState, useEffect } from 'react';
import '../styles/bottomSheet.css';

type SnapPoint = 'collapsed' | 'mid' | 'expanded';

interface BottomSheetProps {
  children: ReactNode;
  defaultSnap?: SnapPoint;
  onSnapChange?: (snap: SnapPoint) => void;
}

const SNAP_HEIGHTS = {
  collapsed: 20, // 20% of viewport
  mid: 50,       // 50% of viewport
  expanded: 88,  // 88% of viewport
};

export function BottomSheet({ children, defaultSnap = 'mid', onSnapChange }: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset position when defaultSnap changes (e.g., navigating between pages)
  useEffect(() => {
    setCurrentSnap(defaultSnap);
    if (sheetRef.current) {
      sheetRef.current.style.height = `${getHeightForSnap(defaultSnap)}vh`;
    }
  }, [defaultSnap]);

  const getHeightForSnap = (snap: SnapPoint) => {
    return SNAP_HEIGHTS[snap];
  };

  const findNearestSnap = (heightPercent: number): SnapPoint => {
    const distances = {
      collapsed: Math.abs(heightPercent - SNAP_HEIGHTS.collapsed),
      mid: Math.abs(heightPercent - SNAP_HEIGHTS.mid),
      expanded: Math.abs(heightPercent - SNAP_HEIGHTS.expanded),
    };

    return Object.entries(distances).reduce((nearest, [snap, distance]) => {
      return distance < distances[nearest] ? snap as SnapPoint : nearest;
    }, 'collapsed' as SnapPoint);
  };

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    setDragStartY(clientY);
    setDragStartHeight(getHeightForSnap(currentSnap));
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || !sheetRef.current) return;

    const deltaY = dragStartY - clientY;
    const viewportHeight = window.innerHeight;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    const newHeightPercent = Math.max(10, Math.min(92, dragStartHeight + deltaPercent));

    // Apply height directly during drag for smooth feedback
    sheetRef.current.style.height = `${newHeightPercent}vh`;
  };

  const handleDragEnd = () => {
    if (!isDragging || !sheetRef.current) return;

    const currentHeight = sheetRef.current.offsetHeight;
    const viewportHeight = window.innerHeight;
    const currentPercent = (currentHeight / viewportHeight) * 100;

    const nearestSnap = findNearestSnap(currentPercent);
    setCurrentSnap(nearestSnap);
    setIsDragging(false);
    
    // Reset to snap point
    sheetRef.current.style.height = `${getHeightForSnap(nearestSnap)}vh`;
    
    if (onSnapChange) {
      onSnapChange(nearestSnap);
    }
  };

  // Mouse events (only on handle)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only prevent default on the handle itself, not on content
    e.stopPropagation();
    handleDragStart(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartY, dragStartHeight, currentSnap]);

  // Touch events (only on handle)
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default to stop scrolling while dragging handle
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
    }
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleDragEnd();
  };

  return (
    <div
      ref={sheetRef}
      className={`bottom-sheet ${currentSnap}`}
      style={{
        height: `${getHeightForSnap(currentSnap)}vh`,
        transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Drag handle */}
      <div
        className="sheet-drag-handle"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-pill" />
      </div>

      {/* Sheet content */}
      <div className="sheet-content">
        {children}
      </div>
    </div>
  );
}
