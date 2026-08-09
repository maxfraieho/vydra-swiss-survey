import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { PatternRow, createPattern, deletePattern } from '../../api/settings';
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { Badge } from '@astryxdesign/core/Badge';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { useToast } from '@astryxdesign/core/Toast';

export const PatternsPanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const toast = useToast();
  const { data: patterns, loading: patternsLoading, error: patternsError, refetch: refetchPatterns } =
    useResource<PatternRow[]>('/api/settings/patterns');

  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [keywordsText, setKeywordsText] = useState<string>('');
  const [qualifyingPolarity, setQualifyingPolarity] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [patternToDelete, setPatternToDelete] = useState<PatternRow | null>(null);

  const formatKeywords = (kwStr: string): string => {
    if (!kwStr) return '—';
    try {
      const parsed = JSON.parse(kwStr);
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch {}
    return kwStr;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedKey = key.trim();
    if (!trimmedKey) {
      setSubmitError("Будь ласка, вкажіть ключ патерна (key)");
      return;
    }

    const keywordsArray = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    setSubmitting(true);
    try {
      await createPattern({
        key: trimmedKey,
        label: label.trim() || undefined,
        keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
        qualifying_polarity: qualifyingPolarity || undefined,
      });
      setKey('');
      setLabel('');
      setKeywordsText('');
      setQualifyingPolarity('');
      setAttemptedSubmit(false);
      toast({ body: 'Збережено' });
      refetchPatterns();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося створити патерн', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pattern: PatternRow) => {
    if (pattern.is_builtin === 1) return;
    setPatternToDelete(pattern);
    setConfirmDeleteOpen(true);
  };

  return (
    <VStack gap={5}>
      {/* Table Card */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-emphasized)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Heading level={3} style={{ fontSize: '15px' }}>
            Патерни ({patterns?.length || 0})
          </Heading>
          {patternsLoading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Завантаження...</span>}
        </div>

        {patternsError && (
          <div style={{ padding: '16px 20px', color: 'var(--color-text-red)', fontSize: '13px' }}>
            ⚠️ Помилка завантаження патернів: {patternsError.message}
          </div>
        )}

        {!patternsLoading && patterns && patterns.length === 0 && (
          <div style={{ padding: '24px 20px', color: 'var(--color-text-tertiary)', fontSize: '13px', textAlign: 'center' }}>
            Патерни відсутні. Створіть перший патерн за допомогою форми нижче.
          </div>
        )}

        {patterns && patterns.length > 0 && (
          <Table hasHover density="compact">
            <TableHeader>
              <TableRow isHeaderRow>
                <TableHeaderCell style={{ width: '100px' }}>Key</TableHeaderCell>
                <TableHeaderCell style={{ width: '130px' }}>Label</TableHeaderCell>
                <TableHeaderCell style={{ width: 'auto' }}>Keywords</TableHeaderCell>
                <TableHeaderCell style={{ width: '110px' }}>Polarity</TableHeaderCell>
                <TableHeaderCell style={{ width: '100px' }}>Тип</TableHeaderCell>
                <TableHeaderCell style={{ width: '90px', textAlign: 'right' }}>Дії</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((p) => {
                const isBuiltin = p.is_builtin === 1;
                return (
                  <TableRow key={p.id || p.key}>
                    <TableCell style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontWeight: 600 }}>{p.key}</TableCell>
                    <TableCell style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{p.label || '—'}</TableCell>
                    <TableCell style={{ color: 'var(--color-text-secondary)', fontSize: '12px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{formatKeywords(p.keywords)}</TableCell>
                    <TableCell style={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>{p.qualifying_polarity || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={isBuiltin ? 'info' : 'neutral'} label={isBuiltin ? 'вбудований' : 'користувацький'} />
                    </TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={isBuiltin}
                        onClick={() => handleDelete(p)}
                        style={{
                          padding: '4px 10px',
                          minHeight: '44px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isBuiltin ? 'not-allowed' : 'pointer',
                          opacity: isBuiltin ? 0.4 : 1,
                          border: isBuiltin ? '1px solid var(--color-border)' : '1px solid var(--color-border-red)',
                          background: isBuiltin ? 'var(--color-background-muted)' : 'rgba(239, 68, 68, 0.1)',
                          color: isBuiltin ? 'var(--color-text-tertiary)' : 'var(--color-text-red)',
                        }}
                      >
                        Вилучити
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Creation Form Card */}
      <Card padding={5}>
      <form
        onSubmit={handleCreate}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Heading level={4} style={{ fontSize: '14px' }}>
          + Додати патерн
        </Heading>


        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <TextInput
            label="Key (Ідентифікатор)"
            isRequired
            value={key}
            onChange={setKey}
            placeholder="e.g. tobacco"
            status={attemptedSubmit && !key.trim() ? { type: 'error', message: "Обов'язкове поле" } : undefined}
          />

          <TextInput
            label="Label (Назва)"
            isOptional
            value={label}
            onChange={setLabel}
            placeholder="e.g. Тютюн та паління"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
          <TextInput
            label="Keywords (через кому)"
            isOptional
            value={keywordsText}
            onChange={setKeywordsText}
            placeholder="e.g. tobacco, smoking, cigarette"
          />

          <Selector
            label="Qualifying Polarity"
            value={qualifyingPolarity || undefined}
            onChange={(v) => setQualifyingPolarity(v || '')}
            placeholder="— не вказано —"
            options={[
              { value: 'affirm', label: 'affirm' },
              { value: 'deny', label: 'deny' },
              { value: 'not_fully_healthy', label: 'not_fully_healthy' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Button
            type="submit"
            variant="primary"
            isDisabled={submitting}
            label={submitting ? 'Збереження...' : 'Створити патерн'}
          />
        </div>
      </form>
      </Card>

      <AlertDialog
        isOpen={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={patternToDelete ? `Вилучити патерн "${patternToDelete.key}"?` : ''}
        description="Цю дію неможливо скасувати."
        actionLabel="Вилучити"
        onAction={async () => {
          if (!patternToDelete) return;
          try {
            await deletePattern(patternToDelete.key);
            toast({ body: 'Вилучено' });
            refetchPatterns();
          } catch (err: any) {
            toast({ body: err?.message || 'Не вдалося вилучити патерн', type: 'error' });
          } finally {
            setConfirmDeleteOpen(false);
            setPatternToDelete(null);
          }
        }}
      />
    </VStack>
  );
};
