import { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MainArea } from '@/components/main/MainArea';
import { cn } from '@/lib/utils';

const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 420;

export function AppLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        return width;
      }
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const clampedWidth = Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
      console.log('Drag:', { newWidth, clampedWidth, MIN: MIN_SIDEBAR_WIDTH, MAX: MAX_SIDEBAR_WIDTH });
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('sidebar-width', sidebarWidth.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, sidebarWidth]);

  return (
    <div ref={containerRef} className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        style={{ width: sidebarWidth }}
        className="h-full shrink-0"
      >
        <Sidebar />
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'w-1 h-full shrink-0 cursor-col-resize transition-colors',
          'bg-border hover:bg-primary/30',
          isDragging && 'bg-primary/50'
        )}
      />

      {/* Main Area */}
      <div className="flex-1 h-full min-w-0">
        <MainArea />
      </div>

      {/* Overlay during drag to prevent text selection */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
    </div>
  );
}
