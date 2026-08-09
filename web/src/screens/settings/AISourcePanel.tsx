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
import { useIsNarrow } from '../../shell/useIsNarrow';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { Badge } from '@astryxdesign/core/Badge';
import { useToast } from '@astryxdesign/core/Toast';

export const AISourcePanel: React.FC = () => {
  const isNarrow = useIsNarrow();
  const toast = useToast();

  const { data: config, loading, error, refetch } = useResource<AISourceConfig>('/api/settings/ai-source');

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
      toast({ body: 'Налаштування AI-джерела збережено' });
      setTokenInput('');
      refetch();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося зберегти налаштування', type: 'error' });
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
        toast({ body: 'Тест пройдено успішно' });
      } else {
        toast({ body: 'Тест завершився з помилкою', type: 'error' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, detail: err?.message || 'Помилка виконання тесту' });
      toast({ body: err?.message || 'Помилка виконання тесту', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleStartProbe = async () => {
    setProbing(true);
    setProbeStatus(null);
    try {
      await probeModels();
      toast({ body: 'Зондування vision-моделей розпочато' });
    } catch (err: any) {
      setProbing(false);
      toast({ body: err?.message || 'Не вдалося розпочати зондування', type: 'error' });
    }
  };

  return (
    <VStack gap={5}>
      {/* Current Configuration Card */}
      <Card padding={5}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
              🤖 ДЖЕРЕЛО ВІЗУАЛЬНОЇ МОДЕЛІ
            </span>
            <Heading level={3} style={{ marginTop: '4px', fontSize: '16px' }}>
              Налаштування AI-джерела
            </Heading>
          </div>
          {loading && <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>Завантаження...</span>}
        </div>

        {error && (
          <div style={{ padding: '12px', color: 'var(--color-text-red)', fontSize: '13px', marginBottom: '16px' }}>
            ⚠️ Помилка завантаження конфігурації: {error.message}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Selector
            label="Тип AI-джерела (Backend)"
            value={backend}
            onChange={(v) => setBackend((v as 'proxy' | 'local') || 'proxy')}
            options={[
              { value: 'proxy', label: '🌐 Remote Proxy (Aegis Relay)' },
              { value: 'local', label: '📱 On-Device Model (llama.cpp Gemma 3 4B)' },
            ]}
          />

          {backend === 'proxy' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <TextInput
                  label="URL проксі (Base URL)"
                  value={baseUrl}
                  onChange={setBaseUrl}
                  placeholder="e.g. http://192.168.3.184:18880"
                  isRequired
                />
                <TextInput
                  label="Модель (Model / Slot)"
                  value={model}
                  onChange={setModel}
                  placeholder="e.g. multimedia-proxy"
                  isRequired
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                  Токен доступу (Bearer Token)
                </label>

                {config?.token_configured && !showTokenInput ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Badge variant="success" label="🔑 токен налаштовано" />
                    <Button
                      type="button"
                      label="Змінити токен"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTokenInput(true)}
                    />
                    <Button
                      type="button"
                      label="Очистити токен"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        updateAISourceConfig({ backend, base_url: baseUrl, model, token: '' })
                          .then(() => {
                            toast({ body: 'Токен очищено' });
                            refetch();
                          })
                          .catch((e) => toast({ body: e.message, type: 'error' }));
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <TextInput
                      type="password"
                      label=""
                      value={tokenInput}
                      onChange={setTokenInput}
                      placeholder="Введіть Secret Token для проксі"
                    />
                    {config?.token_configured && (
                      <Button
                        type="button"
                        label="Скасувати зміну"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTokenInput(false)}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {backend === 'local' && (
            <VStack gap={3}>
              <TextInput
                label="Шлях до GGUF-моделі (Model path)"
                value={model}
                onChange={setModel}
                placeholder="e.g. ~/models/gemma3-4b/gemma-3-4b-it-Q4_K_M.gguf"
              />
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--color-border-emphasized)',
                  fontSize: '12px',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <strong>ℹ️ Налаштування локального виконання:</strong>
                <br />
                - Використовує binary <code>llama-mtmd-cli</code> з <code>-t 4</code> (4 CPU потоки).
                <br />
                - Потрібно не менше <strong>4.5 GB вільної RAM</strong> перед запуском.
                <br />
                - Взаємне виключення із запуском опитувань (виконується послідовно).
              </div>
            </VStack>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            <Button
              type="submit"
              variant="primary"
              isDisabled={saving}
              label={saving ? 'Збереження...' : 'Зберегти конфігурацію'}
            />
            <Button
              type="button"
              variant="secondary"
              isDisabled={testing}
              onClick={handleTest}
              label={testing ? 'Перевірка...' : 'Перевірити джерело'}
            />
          </div>
        </form>

        {/* Test Result Display */}
        {testResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '6px',
              border: `1px solid ${testResult.ok ? 'var(--color-border-green, #10b981)' : 'var(--color-border-red, #ef4444)'}`,
              background: testResult.ok ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', color: testResult.ok ? 'var(--color-text-green)' : 'var(--color-text-red)', marginBottom: '4px' }}>
              {testResult.ok ? '✅ Джерело успішно перевірено' : '❌ Помилка перевірки джерела'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {testResult.detail}
            </div>
          </div>
        )}
      </Card>

      {/* Model Probe Card */}
      <Card padding={5}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <Heading level={4} style={{ fontSize: '14px' }}>
              🔍 Зондування vision-моделей (Probe)
            </Heading>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              Перевіряє доступність та можливість обробки зображень для всіх доступних моделей.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            isDisabled={probing}
            onClick={handleStartProbe}
            label={probing ? 'Зондування...' : 'Знайти vision-моделі'}
          />
        </div>

        {probeStatus && (
          <VStack gap={3} style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <Badge
                variant={
                  probeStatus.status === 'finished'
                    ? 'success'
                    : probeStatus.status === 'running'
                    ? 'warning'
                    : probeStatus.status === 'error'
                    ? 'danger'
                    : 'neutral'
                }
                label={`Статус: ${probeStatus.status}`}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Прогрес: {probeStatus.progress} / {probeStatus.total}
              </span>
            </div>

            {probeStatus.error && (
              <div style={{ padding: '8px 12px', color: 'var(--color-text-red)', fontSize: '12px' }}>
                ⚠️ {probeStatus.error}
              </div>
            )}

            {probeStatus.results && probeStatus.results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {probeStatus.results.map((res, idx) => (
                  <Card key={idx} padding={3}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{res.model}</span>
                      <Badge
                        variant={res.vision_capable ? 'success' : 'danger'}
                        label={res.vision_capable ? 'Vision-ready' : 'No vision'}
                      />
                    </div>
                    {res.detail && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-disabled)', fontFamily: 'monospace' }}>
                        {res.detail}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </VStack>
        )}
      </Card>
    </VStack>
  );
};
