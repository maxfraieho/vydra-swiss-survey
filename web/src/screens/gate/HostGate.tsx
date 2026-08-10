import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useResource } from '../../api/hooks';
import { HostRow } from '../../api/settings';
import { HostGateData, approveHostGate } from '../../api/rules';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { useToast } from '@astryxdesign/core/Toast';

export const HostGate: React.FC = () => {
  const { host: routeHost } = useParams<{ host?: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const selectedHost = routeHost ? decodeURIComponent(routeHost) : '*';

  const { data: hostsList } = useResource<HostRow[]>('/api/settings/hosts');
  const { data: gateData, loading: gateLoading, error: gateError, refetch: refetchGate } =
    useResource<HostGateData>(`/api/gate/${encodeURIComponent(selectedHost)}`);

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Build host options including '*' and all configured hosts
  const hostOptions = ['*'];
  if (hostsList) {
    for (const h of hostsList) {
      if (h.hostname && !hostOptions.includes(h.hostname)) {
        hostOptions.push(h.hostname);
      }
    }
  }

  const handleHostChange = (newHost: string) => {
    navigate(`/gate/${encodeURIComponent(newHost)}`);
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await approveHostGate(selectedHost, { playbook_mode: 'active' });
      toast({ body: `Правила хоста '${selectedHost}' увімкнено (active)!` });
      refetchGate();
    } catch (err: any) {
      toast({ body: err?.message || 'Не вдалося увімкнути правила хоста', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VStack gap={5}>
      {/* Header & Selector */}
      <Card padding={5}>
        <VStack gap={4}>
          <HStack justify="space-between" align="center">
            <div>
              <Heading level={2} style={{ marginBottom: '4px' }}>
                🛡️ Гейт хоста (Host Gate)
              </Heading>
              <Text type="body" color="secondary" display="block">
                Керування режимом навчання та активацією правил для вибраного хоста.
              </Text>
            </div>
            {gateData && (
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background:
                    gateData.playbook_mode === 'active'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : gateData.playbook_mode === 'shadow'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(107, 114, 128, 0.15)',
                  border: `1px solid ${
                    gateData.playbook_mode === 'active'
                      ? '#059669'
                      : gateData.playbook_mode === 'shadow'
                      ? '#d97706'
                      : '#4b5563'
                  }`,
                  color:
                    gateData.playbook_mode === 'active'
                      ? 'var(--color-text-green)'
                      : gateData.playbook_mode === 'shadow'
                      ? 'var(--color-text-yellow)'
                      : '#9ca3af',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                РЕЖИМ: {gateData.playbook_mode.toUpperCase()}
              </div>
            )}
          </HStack>

          <div style={{ maxWidth: '360px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px', display: 'block', color: 'var(--color-text-secondary)' }}>
              Вибір хоста:
            </label>
            <Selector
              value={selectedHost}
              onChange={(e) => handleHostChange(e.target.value)}
              options={hostOptions.map((h) => ({
                label: h === '*' ? '* (Глобальний / Усі хости)' : h,
                value: h,
              }))}
            />
          </div>
        </VStack>
      </Card>

      {/* Loading & Error states */}
      {gateLoading && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '13px' }}>
          Завантаження метрик гейта хоста '{selectedHost}'...
        </div>
      )}

      {gateError && (
        <Card padding={5}>
          <Text type="body" style={{ color: 'var(--color-text-red)' }}>
            ⚠️ Помилка завантаження гейта: {gateError.message}
          </Text>
        </Card>
      )}

      {/* Metrics Checklist Card */}
      {!gateLoading && !gateError && gateData && (
        <Card padding={5}>
          <VStack gap={4}>
            <Heading level={3} style={{ fontSize: '16px', marginBottom: '8px' }}>
              📋 Чек-лист готовності хоста: <code style={{ color: 'var(--color-accent)' }}>{gateData.host}</code>
            </Heading>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {/* Metric Item: Shadow rules */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-subtle)',
                  border: `1px solid ${gateData.unreviewed_shadow_rules > 0 ? 'var(--color-border-yellow)' : 'var(--color-border-subtle)'}`,
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Незрозглянуті Shadow-правила
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: gateData.unreviewed_shadow_rules > 0 ? 'var(--color-text-yellow)' : 'var(--color-text-primary)' }}>
                  {gateData.unreviewed_shadow_rules > 0 ? `⚠️ ${gateData.unreviewed_shadow_rules}` : '✅ 0'}
                </div>
                {gateData.unreviewed_shadow_rules > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '12px' }}>
                    <Link to="/rules" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                      Розглянути в Правилах →
                    </Link>
                  </div>
                )}
              </div>

              {/* Metric Item: Conflicts */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-subtle)',
                  border: `1px solid ${gateData.conflicts_count > 0 ? 'var(--color-border-red)' : 'var(--color-border-subtle)'}`,
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Невирішені Конфлікти
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: gateData.conflicts_count > 0 ? 'var(--color-text-red)' : 'var(--color-text-primary)' }}>
                  {gateData.conflicts_count > 0 ? `🚨 ${gateData.conflicts_count}` : '✅ 0'}
                </div>
                {gateData.conflicts_count > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '12px' }}>
                    <Link to="/rules/conflicts" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                      Вирішити в Конфліктах →
                    </Link>
                  </div>
                )}
              </div>

              {/* Metric Item: Completed Run */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Завершений успішний прогін
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: gateData.has_completed_run ? 'var(--color-text-green)' : 'var(--color-text-red)' }}>
                  {gateData.has_completed_run ? '✅ Зафіксовано' : '❌ Відсутній'}
                </div>
              </div>

              {/* Metric Item: Total Rules breakdown */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  Загальна статистика правил
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  <strong>Всього:</strong> {gateData.total_rules} |{' '}
                  <span style={{ color: 'var(--color-text-green)' }}>Active: {gateData.active_rules}</span> |{' '}
                  <span style={{ color: '#9ca3af' }}>Retired: {gateData.retired_rules}</span>
                </div>
                {gateData.missing_evidence_rules > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                    Без доказів (evidence): {gateData.missing_evidence_rules}
                  </div>
                )}
              </div>
            </div>

            {/* Gated status summary */}
            {gateData.gated_by && (
              <Text type="body" color="secondary" style={{ fontSize: '13px' }}>
                ℹ️ Налаштування гейта успадковано від рівню: <code>{gateData.gated_by}</code>
              </Text>
            )}

            {/* Approve Button Action */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <HStack justify="space-between" align="center">
                <div>
                  {gateData.ready_for_active ? (
                    <Text type="body" style={{ color: 'var(--color-text-green)', fontWeight: 600 }}>
                      ✅ Всі умови виконано. Хост готовий до увімкнення правил!
                    </Text>
                  ) : (
                    <Text type="body" style={{ color: 'var(--color-text-yellow)', fontWeight: 600 }}>
                      ⚠️ Увага: Увімкнення заблоковано до виконання всіх умов чек-листа (shadow-правила, конфлікти, хоча б 1 успішний прогін).
                    </Text>
                  )}
                </div>

                <Button
                  variant="primary"
                  onClick={handleApprove}
                  disabled={!gateData.ready_for_active || submitting}
                >
                  {submitting ? 'Збереження...' : gateData.playbook_mode === 'active' ? 'Правила увімкнено (Оновити active)' : 'Увімкнути правила хоста'}
                </Button>
              </HStack>
            </div>
          </VStack>
        </Card>
      )}
    </VStack>
  );
};
