import React, { useState } from 'react';
import { apiFetch } from '../../api/client';
import { useResource } from '../../api/hooks';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '@astryxdesign/core/Toast';

interface TelegramTokenStatus {
  configured: boolean;
  masked: string | null;
}

export const TelegramSettingsPanel: React.FC = () => {
  const toast = useToast();
  const { data, loading, error, refetch } = useResource<TelegramTokenStatus>(
    '/api/settings/telegram-token'
  );

  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast({ body: 'Введіть токен Telegram', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/settings/telegram-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      toast({ body: 'Токен Telegram успішно збережено' });
      setToken('');
      refetch();
    } catch (err: any) {
      toast({ body: err?.message || 'Помилка збереження токена Telegram', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const maskedText = data?.configured && data?.masked
    ? `Токен налаштовано: ${data.masked}`
    : 'Токен не налаштовано — використовується типовий';

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              ✈️ TELEGRAM BOT TOKEN
            </span>
            <Heading level={3} style={{ marginTop: '4px', fontSize: '16px' }}>
              Налаштування токена Telegram
            </Heading>
          </div>
          {loading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Завантаження...</span>}
        </div>

        {error && (
          <div style={{ padding: '12px', color: 'var(--color-text-red)', fontSize: '13px', marginBottom: '16px' }}>
            ⚠️ Помилка завантаження стану: {error.message}
          </div>
        )}

        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {data?.configured ? (
            <Badge variant="success" label={maskedText} />
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
              {maskedText}
            </span>
          )}
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TextInput
            type="password"
            label="Новий токен Telegram (Bot API Token)"
            value={token}
            onChange={setToken}
            placeholder={data?.masked ? `Поточний токен: ${data.masked}` : 'Введіть токен бота (напр. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)'}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              type="submit"
              variant="primary"
              isDisabled={saving || !token.trim()}
              label={saving ? 'Збереження...' : 'Зберегти'}
            />
          </div>
        </form>
      </Card>
    </VStack>
  );
};
