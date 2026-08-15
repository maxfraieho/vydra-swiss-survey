import React, { useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Button } from '@astryxdesign/core/Button';
import { FormGrid } from '../ui/primitives';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';

export interface LaunchFormProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (params: {
    url: string;
    personaId: string;
    browserSource: string;
    autonomous: boolean;
    trainingMode: boolean;
  }) => Promise<void>;
  personas?: Array<{ id: string; name: string }>;
  browserSources?: Array<{ key: string; name: string }>;
}

export const LaunchForm: React.FC<LaunchFormProps> = ({
  isOpen,
  onClose,
  onLaunch,
  personas = [{ id: 'swiss_default', name: 'Swiss Default Persona' }],
  browserSources = [{ key: 'laptop_comet', name: 'Laptop Comet (192.168.3.30:9226)' }],
}) => {
  const [url, setUrl] = useState('');
  const [personaId, setPersonaId] = useState(personas[0]?.id || 'swiss_default');
  const [browserSource, setBrowserSource] = useState(browserSources[0]?.key || 'laptop_comet');
  const [autonomous, setAutonomous] = useState(false);
  const [trainingMode, setTrainingMode] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      await onLaunch({
        url: url.trim(),
        personaId,
        browserSource,
        autonomous,
        trainingMode,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const personaOptions = personas.map((p) => ({ value: p.id, label: p.name }));
  const sourceOptions = browserSources.map((s) => ({ value: s.key, label: s.name }));

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <DialogHeader title="Запуск сесії опитування" />
      <form onSubmit={handleSubmit}>
        <FormGrid columns={1}>
          <TextInput
            label="URL опитування"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://opinionhero.com/... або https://meinungsplatz.ch/..."
            required
          />

          <Selector
            label="Персона"
            value={personaId}
            onChange={(val) => setPersonaId(val)}
            options={personaOptions}
          />

          <Selector
            label="Джерело браузера"
            value={browserSource}
            onChange={(val) => setBrowserSource(val)}
            options={sourceOptions}
          />

          <div className="flex-row gap-md my-xs">
            <label className="flex-row items-center gap-xs text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={trainingMode}
                onChange={(e) => setTrainingMode(e.target.checked)}
              />
              Навчальний режим (Shadow Rules)
            </label>
            <label className="flex-row items-center gap-xs text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autonomous}
                onChange={(e) => setAutonomous(e.target.checked)}
              />
              Повністю автономний
            </label>
          </div>

          <div className="flex-row justify-end gap-sm mt-md">
            <Button variant="secondary" onClick={onClose} type="button">
              Скасувати
            </Button>
            <Button variant="primary" type="submit" disabled={loading || !url.trim()}>
              {loading ? 'Запуск...' : 'Старт опитування'}
            </Button>
          </div>
        </FormGrid>
      </form>
    </Dialog>
  );
};
