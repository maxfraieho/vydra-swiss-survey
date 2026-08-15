import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { useViewportMode } from './useViewportMode';
import { useTutorRelay } from './useTutorRelay';
import { ViewportToolbar } from './ViewportToolbar';
import { SurveyStatusPill } from '../ui/primitives';
import type { SurveyStatus } from '../ui/tokens';
import type { TargetBBox, NormalizedPoint } from '../types/agent';

export interface ViewportProps {
  screenshotSrc: string;
  url?: string | null;
  status: SurveyStatus;
  stepIndex?: number | null;
  stepTotal?: number | null;
  targetBbox?: TargetBBox | null;
  isPointPickerMode?: boolean;
  onPointPicked?: (p: NormalizedPoint) => void;
  onApprove?: () => void;
  onCorrect?: () => void;
  onPause?: () => void;
  onRefresh?: () => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  screenshotSrc,
  url,
  status,
  stepIndex,
  stepTotal,
  targetBbox,
  isPointPickerMode = false,
  onPointPicked,
  onApprove,
  onCorrect,
  onPause,
  onRefresh,
}) => {
  const { mode, setMode, containerRef, toggleFullscreen } = useViewportMode();
  const [scale, setScale] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);

  const {
    imgRef,
    relayLoading,
    relayFeedback,
    clickMarker,
    dispatchRelay,
    handleImageClick,
  } = useTutorRelay(onRefresh);

  const isExpanded = mode === 'focus' || mode === 'fullscreen';

  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    handleImageClick(e, isPointPickerMode);
    if (isPointPickerMode && onPointPicked && imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onPointPicked({ x: nx, y: ny });
    }
  };

  return (
    <div ref={containerRef} className={isExpanded ? 'fixed-fullscreen' : 'relative w-full'}>
      <Card padding={3}>
        {/* Top Header Bar */}
        <div className="flex-between mb-sm">
          <div className="flex-row gap-sm items-center">
            <SurveyStatusPill status={status} />
            {url && (
              <span className="text-xs text-secondary truncate max-w-sm">
                {url}
              </span>
            )}
            {stepIndex != null && (
              <span className="text-xs text-tertiary">
                Крок {stepIndex}{stepTotal ? `/${stepTotal}` : ''}
              </span>
            )}
          </div>
          <div className="flex-row gap-xs">
            <Button variant="secondary" size="sm" onClick={() => setScale((s) => (s > 1 ? 1 : 1.75))}>
              {scale > 1 ? '🔍 100%' : '🔍 175%'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onRefresh}>
              🔄
            </Button>
            <Button variant="primary" size="sm" onClick={toggleFullscreen}>
              {mode === 'fullscreen' ? '✕' : '⛶'}
            </Button>
            {mode === 'inline' && (
              <Button variant="secondary" size="sm" onClick={() => setMode('focus')}>
                Фокус
              </Button>
            )}
            {isExpanded && (
              <Button variant="secondary" size="sm" onClick={() => setMode('inline')}>
                Вихід
              </Button>
            )}
          </div>
        </div>

        {/* Viewport Canvas Frame */}
        <div
          className="relative bg-subtle border-emphasized rounded-lg overflow-auto flex-center"
          style={{ minHeight: isExpanded ? '60vh' : '360px', maxHeight: isExpanded ? '75vh' : '520px' }}
        >
          <div className="relative" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <img
              ref={imgRef}
              src={screenshotSrc}
              onClick={onImageClick}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
              className={imgLoaded ? 'block w-full cursor-pointer' : 'hidden'}
              alt="Кадр опитування"
            />

            {targetBbox && imgLoaded && (
              <div
                className="absolute border-default pointer-events-none"
                style={{
                  left: `${targetBbox.x * 100}%`,
                  top: `${targetBbox.y * 100}%`,
                  width: `${targetBbox.w * 100}%`,
                  height: `${targetBbox.h * 100}%`,
                  borderColor: 'var(--color-accent)',
                  background: 'color-mix(in oklab, var(--color-accent) 20%, transparent)',
                }}
              />
            )}

            {clickMarker && imgLoaded && (
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `${clickMarker.px}px`,
                  top: `${clickMarker.py}px`,
                  transform: 'translate(-50%, -50%)',
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--color-text-red)',
                  background: 'color-mix(in oklab, var(--color-text-red) 30%, transparent)',
                }}
              />
            )}
          </div>

          {!imgLoaded && (
            <span className="text-tertiary text-sm">
              Очікування кадру від браузера...
            </span>
          )}
        </div>

        {/* Action Toolbar */}
        <ViewportToolbar
          loading={relayLoading}
          onType={(text) => dispatchRelay({ action: 'type', text })}
          onKey={(key) => dispatchRelay({ action: 'keypress', key })}
          onScroll={(dy) => dispatchRelay({ action: 'scroll', scroll_y: dy })}
        />

        {/* 1-Tap Action Bar in Focus / Fullscreen Mode */}
        {isExpanded && (
          <div className="flex-between gap-md mt-md py-xs border-top">
            <div className="flex-row gap-sm">
              {onApprove && (
                <Button variant="primary" size="md" onClick={onApprove}>
                  ✓ Підтвердити
                </Button>
              )}
              {onCorrect && (
                <Button variant="secondary" size="md" onClick={onCorrect}>
                  ✎ Виправити
                </Button>
              )}
              {onPause && (
                <Button variant="secondary" size="md" onClick={onPause}>
                  ⏸ Пауза
                </Button>
              )}
            </div>
            {relayFeedback && (
              <span className="text-xs text-green">
                {relayFeedback}
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
