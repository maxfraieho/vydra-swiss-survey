import { useState, useCallback, useRef, useEffect } from 'react';

export interface ViewportZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  step?: number;
}

export function useViewportZoom(options: ViewportZoomOptions = {}) {
  const minZoom = options.minZoom ?? 25;
  const maxZoom = options.maxZoom ?? 400;
  const step = options.step ?? 10;

  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [transformOrigin, setTransformOrigin] = useState<string>('50% 50%');

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const touchStateRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);

  const clampZoom = useCallback((val: number) => {
    return Math.max(minZoom, Math.min(maxZoom, Math.round(val)));
  }, [minZoom, maxZoom]);

  const zoomIn = useCallback(() => {
    setZoomPercent((prev) => clampZoom(prev + step));
  }, [clampZoom, step]);

  const zoomOut = useCallback(() => {
    setZoomPercent((prev) => clampZoom(prev - step));
  }, [clampZoom, step]);

  const resetZoom = useCallback(() => {
    setZoomPercent(100);
    setTransformOrigin('50% 50%');
  }, []);

  const fitToWidth = useCallback((containerWidth?: number, contentWidth?: number) => {
    if (canvasRef.current) {
      const cWidth = containerWidth ?? canvasRef.current.clientWidth;
      const targetImg = canvasRef.current.querySelector('img');
      const naturalW = contentWidth ?? (targetImg ? targetImg.naturalWidth || targetImg.clientWidth : 1280);
      if (cWidth > 0 && naturalW > 0) {
        const computed = Math.round((cWidth / naturalW) * 100);
        setZoomPercent(clampZoom(computed));
        setTransformOrigin('0% 0%');
      }
    }
  }, [clampZoom]);

  // Non-passive wheel handler to smoothly intercept Ctrl+Wheel / trackpad pinch
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Zoom on ctrlKey / metaKey (wheel with ctrl or trackpad pinch)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const ox = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
          const oy = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
          setTransformOrigin(`${ox.toFixed(2)}% ${oy.toFixed(2)}%`);
        }

        const delta = -e.deltaY;
        const zoomDelta = delta > 0 ? step : -step;
        setZoomPercent((prev) => clampZoom(prev + zoomDelta));
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, [clampZoom, step]);

  // Touch pinch-to-zoom handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStateRef.current = { initialDist: dist, initialZoom: zoomPercent };

      const el = canvasRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const ox = Math.max(0, Math.min(100, ((midX - rect.left) / rect.width) * 100));
        const oy = Math.max(0, Math.min(100, ((midY - rect.top) / rect.height) * 100));
        setTransformOrigin(`${ox.toFixed(2)}% ${oy.toFixed(2)}%`);
      }
    }
  }, [zoomPercent]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchStateRef.current && touchStateRef.current.initialDist > 0) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStateRef.current.initialDist;
      const targetZoom = touchStateRef.current.initialZoom * ratio;
      setZoomPercent(clampZoom(targetZoom));
    }
  }, [clampZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchStateRef.current = null;
    }
  }, []);

  return {
    zoomPercent,
    scale: zoomPercent / 100,
    transformOrigin,
    canvasRef,
    setZoomPercent,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
