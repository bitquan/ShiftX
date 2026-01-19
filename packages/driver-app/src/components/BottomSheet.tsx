import { ReactNode, useRef, useState, useEffect } from 'react';
import './bottomSheet.css';

type SnapPoint = 'collapsed' | 'expanded';

interface BottomSheetProps {
  children?: ReactNode;
  defaultSnap?: SnapPoint;
  onSnapChange?: (snap: SnapPoint) => void;
  collapsedContent?: ReactNode;
  expandedContent?: ReactNode;
}

// Pixel-based snap heights for driver app
const getSnapHeights = () => {
  const vvh = window.visualViewport?.height ?? window.innerHeight;
  const safeTop = 44; // Status bar height estimate
  
  return {
    collapsed: 160, // Fixed 160px (increased to show buttons)
    expanded: Math.min(0.62 * vvh, vvh - safeTop - 16), // 62% of viewport or leave 16px at top
  };
};

export function BottomSheet({ 
  children, 
  defaultSnap = 'collapsed', 
  onSnapChange,
  collapsedContent,
  expandedContent 
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartTranslateY, setDragStartTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset position when defaultSnap changes
  useEffect(() => {
    setCurrentSnap(defaultSnap);
    updateSheetPosition(defaultSnap);
  }, [defaultSnap]);

  // Handle visualViewport resize (keyboard open/close, orientation change)
  useEffect(() => {
    const handleResize = () => {
      if (!isDragging) {
        updateSheetPosition(currentSnap);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [currentSnap, isDragging]);

  const updateSheetPosition = (snap: SnapPoint) => {
    if (!sheetRef.current) return;
    
    const heights = getSnapHeights();
    const vvh = window.visualViewport?.height ?? window.innerHeight;
    const panelHeight = heights[snap];
    const translateY = vvh - panelHeight;
    
    sheetRef.current.style.transform = `translateY(${translateY}px)`;
  };

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    setDragStartY(clientY);
    
    // Disable map pointer events during drag
    document.documentElement.classList.add('dragging-sheet');
    
    if (sheetRef.current) {
      const transform = window.getComputedStyle(sheetRef.current).transform;
      const matrix = new DOMMatrix(transform);
      setDragStartTranslateY(matrix.m42); // Get current translateY
    }
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || !sheetRef.current) return;

    const deltaY = clientY - dragStartY;
    const newTranslateY = dragStartTranslateY + deltaY;
    
    // Constrain dragging within bounds
    const vvh = window.visualViewport?.height ?? window.innerHeight;
    const heights = getSnapHeights();
    const minTranslateY = vvh - heights.expanded;
    const maxTranslateY = vvh - heights.collapsed;
    
    const constrainedY = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));
    sheetRef.current.style.transform = `translateY(${constrainedY}px)`;
  };

  const handleDragEnd = () => {
    if (!isDragging || !sheetRef.current) return;

    // Re-enable map pointer events
    document.documentElement.classList.remove('dragging-sheet');
    
    const transform = window.getComputedStyle(sheetRef.current).transform;
    const matrix = new DOMMatrix(transform);
    const currentTranslateY = matrix.m42;
    
    const vvh = window.visualViewport?.height ?? window.innerHeight;
    const heights = getSnapHeights();
    const midpoint = vvh - (heights.collapsed + heights.expanded) / 2;
    
    // Snap decision: above midpoint -> expand, below -> collapse
    const newSnap: SnapPoint = currentTranslateY < midpoint ? 'expanded' : 'collapsed';
    
    setCurrentSnap(newSnap);
    setIsDragging(false);
    updateSheetPosition(newSnap);
    
    if (onSnapChange && newSnap !== currentSnap) {
      onSnapChange(newSnap);
    }
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the handle
    if ((e.target as HTMLElement).closest('.sheet-drag-handle')) {
      e.stopPropagation();
      handleDragStart(e.clientY);
    }
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
  }, [isDragging, dragStartY, dragStartTranslateY, currentSnap]);

  // Touch events (only on handle)
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only start drag from the handle - don't interfere with content scrolling
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // CRITICAL: Only preventDefault when actively dragging
    // Otherwise, let browser handle scroll gestures
    if (isDragging) {
      e.preventDefault();
      handleDragMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Only preventDefault if we were dragging
    if (isDragging) {
      e.preventDefault();
      handleDragEnd();
    }
  };

  return (
    <div
      ref={sheetRef}
      className={`driver-bottom-sheet ${currentSnap}`}
      style={{
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
        {/* Conditionally render collapsed or expanded content */}
        {currentSnap === 'collapsed' && collapsedContent ? collapsedContent : null}
        {currentSnap === 'expanded' && expandedContent ? expandedContent : null}
        {/* Always render children if no specific content provided */}
        {!collapsedContent && !expandedContent ? children : null}
      </div>
    </div>
  );
}
