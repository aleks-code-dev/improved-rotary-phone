import { useRef, useCallback } from 'react';

interface SplitterProps {
  orientation: 'vertical' | 'horizontal';
  onResize: (deltaPx: number) => void;
}

export function Splitter({ orientation, onResize }: SplitterProps) {
  const originRef = useRef<number>(0);
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      originRef.current = orientation === 'vertical' ? e.clientX : e.clientY;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [orientation],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const current = orientation === 'vertical' ? e.clientX : e.clientY;
      const delta = current - originRef.current;
      originRef.current = current;
      if (delta !== 0) onResize(delta);
    },
    [orientation, onResize],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const isVertical = orientation === 'vertical';

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
      style={{
        flex: '0 0 auto',
        cursor: isVertical ? 'col-resize' : 'row-resize',
        background: 'var(--color-border)',
        ...(isVertical
          ? { width: 4, alignSelf: 'stretch' }
          : { height: 4, alignSelf: 'stretch' }),
        userSelect: 'none',
        touchAction: 'none',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.background = 'var(--color-accent)';
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.background = 'var(--color-border)';
      }}
    />
  );
}
