import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router';

export type ViewportMode = 'inline' | 'focus' | 'fullscreen';
export const VIEWPORT_FULLSCREEN_QUERY = 'view=fullscreen';

export function useViewportMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const isFsByQuery = typeof window !== 'undefined' && window.location.search.includes(VIEWPORT_FULLSCREEN_QUERY);
  const mode: ViewportMode = rawView === 'fullscreen' || isFsByQuery || rawView === 'focus' ? (rawView === 'focus' ? 'focus' : 'fullscreen') : 'inline';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const setMode = useCallback((newMode: ViewportMode) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newMode === 'inline') {
        next.delete('view');
      } else {
        next.set('view', newMode);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const toggleFullscreen = useCallback(async () => {
    if (mode === 'fullscreen') {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }
      setMode('inline');
    } else {
      setMode('fullscreen');
      if (containerRef.current && containerRef.current.requestFullscreen) {
        try {
          await containerRef.current.requestFullscreen();
        } catch {
          // Fallback to CSS fullscreen
        }
      }
    }
  }, [mode, setMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement && mode === 'fullscreen') {
        // Exited native fullscreen via ESC
        setMode('inline');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [mode, setMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && mode !== 'inline') {
        setMode('inline');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, setMode, toggleFullscreen]);

  return {
    mode,
    setMode,
    containerRef,
    isNativeFullscreen,
    toggleFullscreen,
  };
}
