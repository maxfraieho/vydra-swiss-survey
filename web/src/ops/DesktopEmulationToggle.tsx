import React, { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { apiFetch } from '../api/client';

export interface DesktopEmulationPreset {
  label: string;
  width: number;
  height: number;
}

export const DESKTOP_PRESETS: DesktopEmulationPreset[] = [
  { label: '1280×800', width: 1280, height: 800 },
  { label: '1440×900', width: 1440, height: 900 },
];

export interface DesktopEmulationToggleProps {
  onEmulationChange?: (preset: DesktopEmulationPreset | null) => void;
}

export const DesktopEmulationToggle: React.FC<DesktopEmulationToggleProps> = ({ onEmulationChange }) => {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyEmulation = async (preset: DesktopEmulationPreset | null) => {
    setLoading(true);
    try {
      if (preset) {
        await apiFetch('/api/survey/cdp_emulate', {
          method: 'POST',
          body: JSON.stringify({ width: preset.width, height: preset.height, mobile: false }),
        });
        setActivePreset(preset.label);
        onEmulationChange?.(preset);
      } else {
        await apiFetch('/api/survey/cdp_emulate', {
          method: 'POST',
          body: JSON.stringify({ width: 0, height: 0, mobile: false }),
        });
        setActivePreset(null);
        onEmulationChange?.(null);
      }
    } catch {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-row gap-xs items-center">
      <span className="text-xs text-tertiary">Емуляція:</span>
      {DESKTOP_PRESETS.map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant={activePreset === p.label ? 'primary' : 'secondary'}
          disabled={loading}
          onClick={() => applyEmulation(activePreset === p.label ? null : p)}
        >
          {p.label}
        </Button>
      ))}
      {activePreset && (
        <Button
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={() => applyEmulation(null)}
        >
          ✕ Скинути
        </Button>
      )}
    </div>
  );
};
