import { useEffect, useState } from 'react';

/**
 * Reactive viewport-width breakpoint for the shell chrome.
 *
 * The shell components (StatusBar / Nav / AppShell) are styled with inline
 * style objects and src/theme/theme.css is machine-generated ("do not edit
 * manually"), so CSS media queries are not an option here. This hook is the
 * JS equivalent: it re-renders the component when the viewport crosses the
 * breakpoint, so the same inline-style approach can stay adaptive.
 *
 * Default 480px covers phones in portrait (360-430px are the common widths).
 */
export function useIsNarrow(maxWidthPx = 480): boolean {
  const query = `(max-width: ${maxWidthPx}px)`;

  const [isNarrow, setIsNarrow] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);

    // Sync once on mount in case the viewport changed before the listener attached.
    setIsNarrow(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isNarrow;
}
