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
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset height when defaultSnap changes
  useEffect(() => {
    setCurrentSnap(defaultSnap);
    updateSheetHeight(defaultSnap);
  }, [defaultSnap]);

  // Handle visualViewport resize (keyboard open/close, orientation change)
  useEffect(() => {
    const handleResize = () => {
      if (!isDragging) {
        updateSheetHeight(currentSnap);
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

  // Height-based positioning (no transform) - fixes iOS scroll
  const updateSheetHeight = (snap: SnapPoint) => {
    if (!sheetRef.current) return;
    
    const heights = getSnapHeights();
    const panelHeight = heights[snap];
    
    sheetRef.current.style.height = `${panelHeight}px`;
  };

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    setDragStartY(clientY);
    
    // Disable map pointer events during drag
    document.documentElement.classList.add('dragging-sheet');
    
    if (sheetRef.current) {
      const currentHeight = parseInt(sheetRef.current.style.height || '160', 10);
      setDragStartHeight(currentHeight);
    }
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || !sheetRef.current) return;

    const deltaY = clientY - dragStartY;
    // Dragging up (negative deltaY) should increase height
    const newHeight = dragStartHeight - deltaY;
    
    // Constrain within bounds
    const heights = getSnapHeights();
    const minHeight = heights.collapsed;
    const maxHeight = heights.expanded;
    
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    sheetRef.current.style.height = `${constrainedHeight}px`;
  };

  const handleDragEnd = () => {
    if (!isDragging || !sheetRef.current) return;

    // Re-enable map pointer events
    document.documentElement.classList.remove('dragging-sheet');
    
    const currentHeight = parseInt(sheetRef.current.style.height || '160', 10);
    const heights = getSnapHeights();
    const midpoint = (heights.collapsed + heights.expanded) / 2;
    
    // Snap decision: above midpoint height -> expand, below -> collapse
    const newSnap: SnapPoint = currentHeight > midpoint ? 'expanded' : 'collapsed';
    
    setCurrentSnap(newSnap);
    setIsDragging(false);
    updateSheetHeight(newSnap);
    
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

  // Hard drag reset - prevents stuck drag state
  const resetDrag = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    document.documentElement.classList.remove('dragging-sheet');
    
    // Snap to nearest point
    if (sheetRef.current) {
      const currentHeight = parseInt(sheetRef.current.style.height || '160', 10);
      const heights = getSnapHeights();
      const midpoint = (heights.collapsed + heights.expanded) / 2;
      const newSnap: SnapPoint = currentHeight > midpoint ? 'expanded' : 'collapsed';
      
      setCurrentSnap(newSnap);
      updateSheetHeight(newSnap);
      
      if (onSnapChange && newSnap !== currentSnap) {
        onSnapChange(newSnap);
      }
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

    // Add hard reset listeners to prevent stuck drag
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('pointerup', resetDrag);
    window.addEventListener('pointercancel', resetDrag);
    window.addEventListener('blur', resetDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('pointerup', resetDrag);
      window.removeEventListener('pointercancel', resetDrag);
      window.removeEventListener('blur', resetDrag);
    };
  }, [isDragging, dragStartY, dragStartHeight, currentSnap]);

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

  // Add touch reset listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchEndWindow = () => {
      resetDrag();
    };

    const handleTouchCancelWindow = () => {
      resetDrag();
    };

    window.addEventListener('touchend', handleTouchEndWindow);
    window.addEventListener('touchcancel', handleTouchCancelWindow);

    return () => {
      window.removeEventListener('touchend', handleTouchEndWindow);
      window.removeEventListener('touchcancel', handleTouchCancelWindow);
    };
  }, [isDragging, currentSnap]);

  return (
    <div
      ref={sheetRef}
      className={`driver-bottom-sheet ${currentSnap}`}
      style={{
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
        {/* Conditionally render collapsed or expanded content */}
        {currentSnap === 'collapsed' && collapsedContent ? collapsedContent : null}
        {currentSnap === 'expanded' && expandedContent ? expandedContent : null}
        {/* Always render children if no specific content provided */}
        {!collapsedContent && !expandedContent ? children : null}
      </div>
    </div>
  );
}
