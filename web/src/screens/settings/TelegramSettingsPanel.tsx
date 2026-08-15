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
    if (!token.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/settings/telegram-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      toast.show({ variant: 'success', title: 'Токен Telegram успішно збережено' });
      setToken('');
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка збереження токена Telegram', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const maskedText = data?.configured && data?.masked
    ? `Токен налаштовано: ${data.masked}`
    : 'Токен не налаштовано — використовується типовий';

  return (
    <VStack gap={4}>
      <Card padding={4}>
        <div className="flex-between mb-md">
          <Heading level={3}>
            Налаштування токена Telegram
          </Heading>
          {data?.configured && <Badge variant="success" label="Активний" />}
        </div>

        <div className="mb-md">
          <span className="text-xs text-secondary">{maskedText}</span>
        </div>

        <form onSubmit={handleSave} className="flex-col gap-md">
          <TextInput
            type="password"
            label="Новий токен Telegram (Bot API Token)"
            value={token}
            onChange={(val) => setToken(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
            placeholder="Введіть токен бота (напр. 123456:ABC-DEF...)"
          />

          <div className="flex-row justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !token.trim()}
            >
              {saving ? 'Збереження...' : 'Зберегти токен'}
            </Button>
          </div>
        </form>
      </Card>
    </VStack>
  );
};
