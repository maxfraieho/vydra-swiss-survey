import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast, normalizeInputChange } from '../ui/primitives';
import { apiFetch } from '../api/client';

export interface ResumeTabCardProps {
  onResumed?: () => void;
}

const DEFAULT_PERSONAS = [
  { value: 'arno', label: 'Arno (Арсен)' },
  { value: 'annet', label: 'Annette (Олена)' },
];

export const ResumeTabCard: React.FC<ResumeTabCardProps> = ({ onResumed }) => {
  const toast = useToast();
  const [profile, setProfile] = useState<string>('arno');
  const [tabUrl, setTabUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isValidUrl = (urlString: string): boolean => {
    const trimmed = urlString.trim();
    if (!trimmed) return false;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const isUrlValid = isValidUrl(tabUrl);

  const notify = (body: string, type: 'info' | 'error' = 'info') => {
    toast.show({ title: body, variant: type });
  };

  const handleResume = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = tabUrl.trim();
    if (!url || !isUrlValid) {
      notify('Вкажіть коректний URL відкритої вкладки', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/survey/resume_tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, resume_tab_url: url }),
      });
      notify('Підключення до вкладки розпочато', 'info');
      setTabUrl('');
      if (onResumed) onResumed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Помилка підключення до вкладки: ${msg}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="resume-attach" className="w-full">
      <Card padding={3}>
        <div className="flex-between mb-sm border-bottom pb-xs">
          <span className="text-sm text-bold text-primary">🔗 Продовжити у відкритій вкладці</span>
        </div>

        <form onSubmit={handleResume} className="flex-col gap-sm">
          <div className="grid-responsive gap-sm items-end">
            <div className="min-w-0">
              <Selector
                label="Персона"
                value={profile}
                onChange={(val) => setProfile(val)}
                options={DEFAULT_PERSONAS}
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextInput
                label="URL відкритої вкладки"
                value={tabUrl}
                onChange={(val) => setTabUrl(normalizeInputChange(val))}
                placeholder="https://meinungsplatz.ch/..."
              />
            </div>
            <div className="flex-row">
              <Button
                variant="primary"
                type="submit"
                disabled={submitting || !isUrlValid}
              >
                {submitting ? 'Підключення…' : '▶ Продовжити'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
};
