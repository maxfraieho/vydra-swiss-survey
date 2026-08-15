import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { PatternRow, createPattern, deletePattern } from '../../api/settings';
import { Badge } from '@astryxdesign/core/Badge';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';
import { MasterDetail } from '../../ui/primitives';

export const PatternsPanel: React.FC = () => {
  const toast = useToast();
  const { data: patterns, refetch: refetchPatterns } =
    useResource<PatternRow[]>('/api/settings/patterns');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [keywordsText, setKeywordsText] = useState<string>('');
  const [qualifyingPolarity, setQualifyingPolarity] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [patternToDelete, setPatternToDelete] = useState<PatternRow | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    const keywordsArray = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    setSubmitting(true);
    try {
      await createPattern({
        key: trimmed,
        label: label.trim() || undefined,
        keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
        qualifying_polarity: qualifyingPolarity || undefined,
      });
      setKey('');
      setLabel('');
      setKeywordsText('');
      setQualifyingPolarity('');
      toast.show({ variant: 'success', title: 'Патерн створено' });
      refetchPatterns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка створення патерну', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!patternToDelete) return;
    try {
      await deletePattern(patternToDelete.id);
      toast.show({ variant: 'info', title: `Патерн '${patternToDelete.key}' видалено` });
      setPatternToDelete(null);
      refetchPatterns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося видалити патерн', description: msg });
    }
  };

  const masterList = (
    <div className="flex-col gap-sm">
      {(patterns || []).map((p) => (
        <Card key={p.id} padding={3}>
          <div className="flex-between">
            <div className="flex-row items-center gap-sm">
              <span className="text-sm text-bold text-accent text-mono">{p.key}</span>
              {p.is_builtin === 1 && <Badge variant="neutral" label="Builtin" />}
            </div>
            {p.is_builtin !== 1 && (
              <Button variant="destructive" size="sm" onClick={() => setPatternToDelete(p)}>
                ✕
              </Button>
            )}
          </div>
          {p.label && <div className="text-xs text-secondary mt-xs">{p.label}</div>}
        </Card>
      ))}
    </div>
  );

  const formSection = (
    <Card padding={4}>
      <form onSubmit={handleCreate} className="flex-col gap-md">
        <Heading level={3}>
          Додати новий патерн
        </Heading>

        <TextInput
          label="Ключ патерну (key)"
          value={key}
          onChange={(val) => setKey(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="e.g. select_household_income"
          required
        />

        <TextInput
          label="Назва (Label)"
          value={label}
          onChange={(val) => setLabel(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="Вибір річного доходу"
        />

        <TextInput
          label="Ключові слова (через кому)"
          value={keywordsText}
          onChange={(val) => setKeywordsText(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
          placeholder="income, einkommen, revenu"
        />

        <Selector
          label="Полярність кваліфікації"
          value={qualifyingPolarity}
          onChange={(v) => setQualifyingPolarity(v)}
          options={[
            { value: '', label: 'Нейтральна (None)' },
            { value: 'positive', label: 'Позитивна (Positive)' },
            { value: 'negative', label: 'Негативна (Negative)' },
          ]}
        />

        <div className="flex-row justify-end mt-sm">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Збереження...' : 'Зберегти патерн'}
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <VStack gap={4}>
      <MasterDetail master={masterList} detail={formSection} />

      <AlertDialog
        isOpen={Boolean(patternToDelete)}
        onClose={() => setPatternToDelete(null)}
        title="Видалити патерн?"
        description={`Ви дійсно хочете видалити '${patternToDelete?.key}'?`}
        confirmLabel="Видалити"
        onConfirm={executeDelete}
      />
    </VStack>
  );
};
