import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { useViewportMode } from './useViewportMode';
import { useViewportZoom } from './useViewportZoom';
import { useTutorRelay } from './useTutorRelay';
import { ViewportToolbar } from './ViewportToolbar';
import { ViewportCorrectionForm } from './ViewportCorrectionForm';
import { DesktopEmulationToggle } from './DesktopEmulationToggle';
import { SurveyStatusPill } from '../ui/primitives';
import type { SurveyStatus } from '../ui/tokens';
import type { HumanCorrection, TargetBBox, NormalizedPoint } from '../types/agent';

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
  onCorrect?: (correction: HumanCorrection) => void;
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);

  const {
    zoomPercent,
    canvasRef,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToWidth,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useViewportZoom();

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
    <div ref={containerRef} data-viewport-mode={mode} className={isExpanded ? 'fixed-fullscreen' : 'relative w-full'}>
      <Card padding={3}>
        {/* Top Header Bar */}
        <div className="flex-between mb-sm flex-wrap gap-xs">
          <div className="flex-row gap-sm items-center flex-wrap">
            <SurveyStatusPill status={status} />
            {url && <span className="text-xs text-secondary truncate max-w-sm">{url}</span>}
            {stepIndex != null && (
              <span className="text-xs text-tertiary">
                Крок {stepIndex}{stepTotal ? ` / ${stepTotal}` : ''}
              </span>
            )}
          </div>

          <div className="flex-row gap-xs items-center flex-wrap">
            <DesktopEmulationToggle />
            <div className="flex-row gap-xs items-center border-subtle rounded-md px-sm py-xs">
              <Button variant="secondary" size="sm" onClick={zoomOut} disabled={zoomPercent <= 25}>−</Button>
              <span className="text-xs text-bold min-w-0" data-testid="viewport-zoom-label">🔍 {zoomPercent}%</span>
              <Button variant="secondary" size="sm" onClick={zoomIn} disabled={zoomPercent >= 400}>+</Button>
              <Button variant="secondary" size="sm" onClick={() => fitToWidth()}>Fit</Button>
              {zoomPercent !== 100 && (
                <Button variant="secondary" size="sm" onClick={resetZoom}>100%</Button>
              )}
            </div>

            <Button variant="secondary" size="sm" onClick={onRefresh}>🔄</Button>
            <Button variant="primary" size="sm" onClick={toggleFullscreen}>
              {mode === 'fullscreen' ? '✕' : '⛶'}
            </Button>
            {mode === 'inline' && (
              <Button variant="secondary" size="sm" onClick={() => setMode('focus')}>Фокус</Button>
            )}
            {isExpanded && (
              <Button variant="secondary" size="sm" onClick={() => setMode('inline')}>Вихід</Button>
            )}
          </div>
        </div>

        {/* Viewport Canvas Frame */}
        <div
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative bg-subtle border-emphasized rounded-lg overflow-auto ${
            isExpanded ? 'viewport-canvas-expanded' : 'viewport-canvas-inline'
          } ${zoomPercent <= 100 ? 'flex-center' : 'block'}`}
        >
          <div
            className="relative m-auto"
            data-testid="viewport-canvas-inner"
            style={{ width: `${zoomPercent}%`, minWidth: `${zoomPercent}%` }}
          >
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
          <div className="flex-col gap-sm mt-md py-xs border-top">
            <div className="flex-between gap-md">
              <div className="flex-row gap-sm">
                {onApprove && (
                  <Button variant="primary" size="md" onClick={onApprove}>✓ Підтвердити</Button>
                )}
                {onCorrect && (
                  <Button variant="secondary" size="md" onClick={() => setIsCorrecting((prev) => !prev)}>
                    ✎ Виправити
                  </Button>
                )}
                {onPause && (
                  <Button variant="secondary" size="md" onClick={onPause}>⏸ Пауза</Button>
                )}
              </div>
              {relayFeedback && <span className="text-xs text-green">{relayFeedback}</span>}
            </div>

            {isCorrecting && (
              <ViewportCorrectionForm
                onSubmit={(corr) => {
                  onCorrect?.(corr);
                  setIsCorrecting(false);
                }}
                onCancel={() => setIsCorrecting(false)}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
