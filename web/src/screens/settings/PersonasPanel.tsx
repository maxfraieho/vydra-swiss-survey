import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { PersonaRow, createPersona, updatePersona, deletePersona } from '../../api/settings';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { MasterDetail, normalizeInputChange, useToast } from '../../ui/primitives';

export const PersonasPanel: React.FC = () => {
  const toast = useToast();
  const { data: personas, refetch: refetchPersonas } =
    useResource<PersonaRow[]>('/api/settings/personas');

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [key, setKey] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [contentMd, setContentMd] = useState<string>('');
  const [active, setActive] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  const handleSelectPersona = (p: PersonaRow) => {
    setSelectedKey(p.key);
    setKey(p.key);
    setLabel(p.label);
    setContentMd(p.content_md || '');
    setActive(p.active);
  };

  const handleNewPersona = () => {
    setSelectedKey(null);
    setKey('');
    setLabel('');
    setContentMd('');
    setActive(1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = key.trim();
    const trimmedLabel = label.trim();
    if (!selectedKey && !trimmedKey) return;
    if (!trimmedLabel) return;

    setSubmitting(true);
    try {
      if (selectedKey) {
        await updatePersona(selectedKey, { label: trimmedLabel, content_md: contentMd, active });
      } else {
        await createPersona({ key: trimmedKey, label: trimmedLabel, content_md: contentMd, active });
        setSelectedKey(trimmedKey);
      }
      toast.show({ variant: 'success', title: 'Персону успішно збережено' });
      refetchPersonas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка збереження', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!selectedKey) return;
    setSubmitting(true);
    try {
      await deletePersona(selectedKey);
      toast.show({ variant: 'info', title: `Персону '${selectedKey}' видалено` });
      setSelectedKey(null);
      handleNewPersona();
      refetchPersonas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося видалити персону', description: msg });
    } finally {
      setSubmitting(false);
      setConfirmDeleteOpen(false);
    }
  };

  const masterContent = (
    <div className="flex-col gap-sm">
      <Button variant="primary" size="sm" onClick={handleNewPersona}>
        + Створити персону
      </Button>
      {(personas || []).map((p) => {
        const isSelected = p.key === selectedKey;
        return (
          <div
            key={p.key}
            onClick={() => handleSelectPersona(p)}
            className={`p-sm rounded-lg cursor-pointer flex-col gap-xs ${isSelected ? 'bg-muted border-emphasized' : 'bg-page border-default'}`}
          >
            <div className="flex-between">
              <span className="text-sm text-bold text-primary text-mono">
                {p.key}
              </span>
              <span className={`text-xs text-semibold ${p.active ? 'text-green' : 'text-tertiary'}`}>
                {p.active ? 'Активна' : 'Вимкнено'}
              </span>
            </div>
            <div className="text-xs text-secondary">{p.label}</div>
          </div>
        );
      })}
    </div>
  );

  const detailContent = (
    <Card padding={4}>
      <form onSubmit={handleSave} className="flex-col gap-md">
        <div className="flex-between border-bottom pb-sm">
          <div>
            <span className="text-xs text-tertiary text-uppercase">
              {selectedKey ? 'Редагування' : 'Створення'}
            </span>
            <Heading level={3}>
              {selectedKey ? `Персона: ${selectedKey}` : 'Нова персона'}
            </Heading>
          </div>
          {selectedKey && (
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
              Вилучити
            </Button>
          )}
        </div>

        <TextInput
          label="Ключ (key)"
          value={key}
          onChange={(val) => setKey(normalizeInputChange(val))}
          disabled={Boolean(selectedKey)}
          placeholder="e.g. arno"
          required
        />

        <TextInput
          label="Назва (label)"
          value={label}
          onChange={(val) => setLabel(normalizeInputChange(val))}
          placeholder="e.g. Арсен (Arno)"
          required
        />

        <Selector
          label="Статус"
          value={String(active)}
          onChange={(v) => setActive(Number(v))}
          options={[
            { value: '1', label: '1 - Активна' },
            { value: '0', label: '0 - Неактивна' },
          ]}
        />

        <TextArea
          label="Markdown профіль / Persona Content"
          value={contentMd}
          onChange={(val) => setContentMd(normalizeInputChange(val))}
          placeholder="# Особисті дані&#10;- Вік: 34&#10;- Місто: Цюрих..."
        />

        <div className="flex-row justify-end mt-xs">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Збереження...' : selectedKey ? 'Оновити' : 'Створити'}
          </Button>
        </div>
      </form>
    </Card>
  );

  return (
    <div>
      <MasterDetail master={masterContent} detail={detailContent} />

      <AlertDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Видалити персону?"
        description={`Ви впевнені, що хочете видалити '${selectedKey}'?`}
        confirmLabel="Видалити"
        onConfirm={executeDelete}
      />
    </div>
  );
};
