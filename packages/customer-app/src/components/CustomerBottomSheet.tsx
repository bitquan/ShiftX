import { ReactNode, useRef, useState, useEffect } from 'react';
import './customerBottomSheet.css';

type SnapPoint = 'collapsed' | 'expanded';

interface CustomerBottomSheetProps {
  children?: ReactNode;
  defaultSnap?: SnapPoint;
  onSnapChange?: (snap: SnapPoint) => void;
}

// Pixel-based snap heights for customer app
const getSnapHeights = () => {
  const vvh = window.visualViewport?.height ?? window.innerHeight;
  const safeTop = 44; // Status bar height estimate
  
  return {
    collapsed: 200, // Fixed 200px
    expanded: Math.min(0.70 * vvh, vvh - safeTop - 16), // 70% of viewport
  };
};

export function CustomerBottomSheet({ 
  children, 
  defaultSnap = 'collapsed', 
  onSnapChange
}: CustomerBottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentSnap(defaultSnap);
    updateSheetHeight(defaultSnap);
  }, [defaultSnap]);

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

  const updateSheetHeight = (snap: SnapPoint) => {
    if (!sheetRef.current) return;
    
    const heights = getSnapHeights();
    const panelHeight = heights[snap];
    
    sheetRef.current.style.height = `${panelHeight}px`;
  };

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    setDragStartY(clientY);
    document.documentElement.classList.add('dragging-sheet');
    
    if (sheetRef.current) {
      const currentHeight = parseInt(sheetRef.current.style.height || '200', 10);
      setDragStartHeight(currentHeight);
    }
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || !sheetRef.current) return;

    const deltaY = clientY - dragStartY;
    const newHeight = dragStartHeight - deltaY;
    
    const heights = getSnapHeights();
    const minHeight = heights.collapsed;
    const maxHeight = heights.expanded;
    
    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    sheetRef.current.style.height = `${constrainedHeight}px`;
  };

  const handleDragEnd = () => {
    if (!isDragging || !sheetRef.current) return;

    document.documentElement.classList.remove('dragging-sheet');
    
    const currentHeight = parseInt(sheetRef.current.style.height || '200', 10);
    const heights = getSnapHeights();
    const midpoint = (heights.collapsed + heights.expanded) / 2;
    
    const newSnap: SnapPoint = currentHeight > midpoint ? 'expanded' : 'collapsed';
    
    setCurrentSnap(newSnap);
    setIsDragging(false);
    updateSheetHeight(newSnap);
    
    if (onSnapChange && newSnap !== currentSnap) {
      onSnapChange(newSnap);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.sheet-drag-handle')) {
      e.stopPropagation();
      handleDragStart(e.clientY);
    }
  };

  const resetDrag = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    document.documentElement.classList.remove('dragging-sheet');
    
    if (sheetRef.current) {
      const currentHeight = parseInt(sheetRef.current.style.height || '200', 10);
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

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleDragMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      handleDragEnd();
    }
  };

  return (
    <div
      ref={sheetRef}
      className={`customer-bottom-sheet ${currentSnap}`}
      onMouseDown={handleMouseDown}
      style={{ height: '200px' }}
    >
      <div 
        className="sheet-drag-handle"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-pill" />
      </div>
      <div className="sheet-content">
        {children}
      </div>
    </div>
  );
}
