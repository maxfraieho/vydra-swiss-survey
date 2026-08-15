import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
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

  const handleResume = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = tabUrl.trim();
    if (!url) {
      toast.show({ variant: 'error', title: 'Вкажіть URL відкритої вкладки' });
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/survey/resume_tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, resume_tab_url: url }),
      });
      toast.show({ variant: 'success', title: 'Підключення до вкладки розпочато' });
      setTabUrl('');
      if (onResumed) onResumed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка підключення до вкладки', description: msg });
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
                onChange={(e) => setTabUrl(e.target.value)}
                placeholder="https://meinungsplatz.ch/... або інший survey URL"
              />
            </div>
            <div className="flex-row">
              <Button
                variant="primary"
                type="submit"
                disabled={submitting || !tabUrl.trim()}
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
