import React, { useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '../ui/primitives';
import { apiFetch } from '../api/client';
import { usePolling } from '../api/hooks';

export interface TelegramQueueItem {
  update_id: number | string;
  url: string;
  text: string;
  received_at: string;
  state: 'pending' | 'claimed' | 'discarded';
}

export interface TelegramListenerState {
  status: 'active' | 'error';
  last_update_at: string | null;
  last_error: string | null;
}

export interface TelegramQueueResponse {
  listener: TelegramListenerState;
  items: TelegramQueueItem[];
}

export interface TelegramQueueCardProps {
  onSurveyStarted?: () => void;
}

export const TelegramQueueCard: React.FC<TelegramQueueCardProps> = ({ onSurveyStarted }) => {
  const toast = useToast();
  const [fetching, setFetching] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | number | null>(null);

  const { data, refetch } = usePolling<TelegramQueueResponse>('/api/survey/telegram_queue', {
    intervalMs: 6000,
  });

  const listener = data?.listener;
  const items = data?.items || [];
  const pendingItems = items.filter((item) => item.state === 'pending');

  const handleFetch = async () => {
    setFetching(true);
    try {
      const res = await apiFetch<{ status: string; processed?: number }>('/api/survey/fetch_telegram', {
        method: 'POST',
      });
      toast.show({
        variant: 'info',
        title: 'Telegram оновлено',
        description: res.processed ? `Отримано нових повідомлень: ${res.processed}` : 'Нових опитувань не знайдено',
      });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка отримання з Telegram', description: msg });
    } finally {
      setFetching(false);
    }
  };

  const handleClaim = async (updateId: number | string) => {
    setActionBusyId(updateId);
    try {
      await apiFetch(`/api/survey/telegram_queue/${updateId}/claim`, { method: 'POST' });
      toast.show({ variant: 'success', title: 'Опитування взято в роботу' });
      refetch();
      if (onSurveyStarted) onSurveyStarted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка взяття в роботу', description: msg });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDiscard = async (updateId: number | string) => {
    setActionBusyId(updateId);
    try {
      await apiFetch(`/api/survey/telegram_queue/${updateId}/discard`, { method: 'POST' });
      toast.show({ variant: 'info', title: 'Опитування відхилено' });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка відхилення', description: msg });
    } finally {
      setActionBusyId(null);
    }
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const isError = listener?.status === 'error';

  return (
    <div data-testid="telegram-queue" className="w-full">
      <Card padding={3}>
        <div className="flex-between flex-wrap gap-sm mb-sm border-bottom pb-xs">
          <div className="flex-row items-center gap-sm flex-wrap">
            <span className="text-sm text-bold text-primary">✈️ Черга опитувань з Telegram</span>
            {isError ? (
              <Badge variant="error" label="Помилка слухача" />
            ) : (
              <Badge variant="success" label="Слухач: Активний" />
            )}
            <span className="text-xs text-tertiary">
              Оновлено: {formatTime(listener?.last_update_at)}
            </span>
          </div>

          <Button variant="secondary" size="sm" onClick={handleFetch} disabled={fetching}>
            {fetching ? 'Завантаження…' : '📥 Підтягнути з Telegram'}
          </Button>
        </div>

        {isError && listener?.last_error && (
          <div className="p-xs mb-sm rounded-md bg-subtle text-xs text-red">
            ⚠️ Помилка бота: {listener.last_error}
          </div>
        )}

        <div className="flex-col gap-xs">
          {pendingItems.length === 0 ? (
            <div className="p-sm text-xs text-tertiary">
              Черга порожня. Нові опитування з Telegram з'являться тут автоматично.
            </div>
          ) : (
            pendingItems.map((item) => (
              <div
                key={item.update_id}
                className="flex-between items-center p-sm rounded-lg bg-subtle border-default gap-sm flex-wrap"
              >
                <div className="flex-col gap-xs min-w-0 flex-1">
                  <div className="flex-row items-center gap-sm">
                    <Badge variant="neutral" label={`#${item.update_id}`} />
                    <span className="text-xs text-secondary">{formatTime(item.received_at)}</span>
                  </div>
                  <span className="text-xs text-primary text-bold truncate max-w-sm">
                    {item.url || 'URL відсутній'}
                  </span>
                  {item.text && item.text !== item.url && (
                    <span className="text-xs text-tertiary truncate">
                      {item.text}
                    </span>
                  )}
                </div>

                <div className="flex-row gap-xs">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleClaim(item.update_id)}
                    disabled={actionBusyId === item.update_id}
                  >
                    ▶ Взяти в роботу
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDiscard(item.update_id)}
                    disabled={actionBusyId === item.update_id}
                  >
                    ✕ Відхилити
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
