import React, { useState, useEffect } from 'react';
import { useResource } from '../../api/hooks';
import {
  AISourceConfig,
  AISourceTestResult,
  ProbeStatus,
  updateAISourceConfig,
  testAISourceConfig,
  probeModels,
  getProbeStatus,
} from '../../api/settings';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '@astryxdesign/core/Toast';

export const AISourcePanel: React.FC = () => {
  const toast = useToast();
  const { data: config, refetch } = useResource<AISourceConfig>('/api/settings/ai-source');

  const [backend, setBackend] = useState<'proxy' | 'local'>('proxy');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<AISourceTestResult | null>(null);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeStatus, setProbeStatus] = useState<ProbeStatus | null>(null);

  useEffect(() => {
    if (config) {
      setBackend(config.backend || 'proxy');
      setBaseUrl(config.base_url || 'http://192.168.3.184:18880');
      setModel(config.model || 'multimedia-proxy');
      setShowTokenInput(!config.token_configured);
    }
  }, [config]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (probing) {
      interval = setInterval(async () => {
        try {
          const st = await getProbeStatus();
          setProbeStatus(st);
          if (st.status === 'finished' || st.status === 'error') {
            setProbing(false);
          }
        } catch {
          setProbing(false);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [probing]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: { backend: 'proxy' | 'local'; base_url?: string; model?: string; token?: string } = {
        backend,
        base_url: baseUrl.trim(),
        model: model.trim(),
      };
      if (showTokenInput && tokenInput.trim()) {
        payload.token = tokenInput.trim();
      }
      await updateAISourceConfig(payload);
      toast.show({ variant: 'success', title: 'Налаштування AI-джерела збережено' });
      setTokenInput('');
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка збереження', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAISourceConfig({
        backend,
        base_url: baseUrl.trim(),
        model: model.trim(),
        token: tokenInput.trim() || undefined,
      });
      setTestResult(res);
      if (res.ok) {
        toast.show({ variant: 'success', title: 'AI-модель успішно відповідає!' });
      } else {
        toast.show({ variant: 'error', title: 'Помилка з’єднання з AI-джерелом', description: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка тестування', description: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleStartProbe = async () => {
    setProbing(true);
    try {
      await probeModels();
      toast.show({ variant: 'info', title: 'Запущено зондування доступних моделей...' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося запустити зондування', description: msg });
      setProbing(false);
    }
  };

  return (
    <VStack gap={4}>
      <Card padding={4}>
        <form onSubmit={handleSave} className="flex-col gap-md">
          <div className="flex-between border-bottom pb-xs">
            <Heading level={3}>
              Конфігурація AI Джерела
            </Heading>
            {config?.token_configured && (
              <Badge variant="success" label="Токен налаштовано" />
            )}
          </div>

          <Selector
            label="Тип бекенду"
            value={backend}
            onChange={(v) => setBackend(v as 'proxy' | 'local')}
            options={[
              { value: 'proxy', label: 'Multimedia Proxy (dev-184 / port 18880)' },
              { value: 'local', label: 'Direct OpenAI / LLM Provider' },
            ]}
          />

          <TextInput
            label="Base URL"
            value={baseUrl}
            onChange={(val) => setBaseUrl(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
            placeholder="http://192.168.3.184:18880"
            required
          />

          <TextInput
            label="Назва моделі"
            value={model}
            onChange={(val) => setModel(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
            placeholder="multimedia-proxy або gpt-4o"
            required
          />

          {showTokenInput ? (
            <TextInput
              label="API Token / Secret"
              type="password"
              value={tokenInput}
              onChange={(val) => setTokenInput(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
              placeholder="Введіть новий токен"
            />
          ) : (
            <div className="flex-row gap-sm items-center">
              <span className="text-xs text-secondary">Токен збережено у сховищі</span>
              <Button variant="secondary" size="sm" onClick={() => setShowTokenInput(true)}>
                Змінити токен
              </Button>
            </div>
          )}

          {testResult && (
            <div className={`p-sm rounded-md border-default ${testResult.ok ? 'border-green bg-subtle' : 'border-red bg-subtle'}`}>
              <div className={`text-xs text-bold ${testResult.ok ? 'text-green' : 'text-red'}`}>
                {testResult.ok ? '✅ Тест пройдено успішно' : `❌ ${testResult.error || 'Помилка'}`}
              </div>
            </div>
          )}

          <div className="flex-between mt-sm">
            <div className="flex-row gap-xs">
              <Button variant="secondary" onClick={handleTest} disabled={testing}>
                {testing ? 'Тестування...' : "Перевірити з'єднання"}
              </Button>
              <Button variant="secondary" onClick={handleStartProbe} disabled={probing}>
                {probing ? 'Зондування...' : 'Зондувати моделі'}
              </Button>
            </div>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Збереження...' : 'Зберегти'}
            </Button>
          </div>
        </form>
      </Card>
    </VStack>
  );
};
