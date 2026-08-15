import { useState, useCallback, useRef } from 'react';
import { getApiBase } from '../api/client';
import type { NormalizedPoint } from '../types/agent';

export interface RelayActionPayload {
  action: 'click' | 'type' | 'keypress' | 'scroll';
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  scroll_x?: number;
  scroll_y?: number;
}

export function useTutorRelay(onActionSuccess?: () => void) {
  const [relayLoading, setRelayLoading] = useState(false);
  const [relayFeedback, setRelayFeedback] = useState<string | null>(null);
  const [clickMarker, setClickMarker] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<NormalizedPoint | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const dispatchRelay = useCallback(async (payload: RelayActionPayload) => {
    setRelayLoading(true);
    setRelayFeedback(null);
    try {
      const res = await fetch(`${getApiBase()}/api/survey/relay_action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setRelayFeedback(data.info || 'Дію виконано в CDP');
        onActionSuccess?.();
      } else {
        setRelayFeedback(`Помилка: ${data.message || data.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRelayFeedback(`Збій зв'язку: ${msg}`);
    } finally {
      setRelayLoading(false);
    }
  }, [onActionSuccess]);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>, isPointPickerMode: boolean = false) => {
    const img = imgRef.current;
    if (!img || !img.clientWidth || !img.clientHeight) return;
    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const naturalW = img.naturalWidth || 1280;
    const naturalH = img.naturalHeight || 800;
    const x = Math.round((clickX / img.clientWidth) * naturalW);
    const y = Math.round((clickY / img.clientHeight) * naturalH);

    const normX = Math.max(0, Math.min(1, clickX / img.clientWidth));
    const normY = Math.max(0, Math.min(1, clickY / img.clientHeight));

    setClickMarker({ x, y, px: clickX, py: clickY });

    if (isPointPickerMode) {
      setSelectedPoint({ x: normX, y: normY });
    } else {
      dispatchRelay({ action: 'click', x, y });
    }
  }, [dispatchRelay]);

  return {
    imgRef,
    relayLoading,
    relayFeedback,
    clickMarker,
    selectedPoint,
    setSelectedPoint,
    dispatchRelay,
    handleImageClick,
  };
}
