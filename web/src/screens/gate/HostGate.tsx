import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useResource } from '../../api/hooks';
import { HostRow } from '../../api/settings';
import { HostGateData, approveHostGate } from '../../api/rules';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Selector } from '@astryxdesign/core/Selector';
import { PageHeader, useToast } from '../../ui/primitives';

export const HostGate: React.FC = () => {
  const { host: routeHost } = useParams<{ host?: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const selectedHost = routeHost ? decodeURIComponent(routeHost) : '*';
  const { data: hostsList } = useResource<HostRow[]>('/api/settings/hosts');
  const { data: gateData, refetch: refetchGate } =
    useResource<HostGateData>(`/api/gate/${encodeURIComponent(selectedHost)}`);

  const [submitting, setSubmitting] = useState<boolean>(false);

  const hostOptions = ['*'];
  if (hostsList) {
    for (const h of hostsList) {
      if (h.hostname && !hostOptions.includes(h.hostname)) {
        hostOptions.push(h.hostname);
      }
    }
  }

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await approveHostGate(selectedHost, { playbook_mode: 'active' });
      toast.show({ variant: 'success', title: `Правила хоста '${selectedHost}' увімкнено (active)!` });
      refetchGate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Не вдалося увімкнути правила хоста', description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const getBadgeVariant = (mode?: string) => {
    if (mode === 'active') return 'success';
    if (mode === 'shadow') return 'warning';
    return 'neutral';
  };

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="ГЕЙТИ"
        title="Гейт хоста (Host Gate)"
        subtitle="Керування режимом навчання та активацією правил для вибраного хоста"
        actions={
          gateData ? (
            <Badge
              variant={getBadgeVariant(gateData.playbook_mode)}
              label={`РЕЖИМ: ${gateData.playbook_mode.toUpperCase()}`}
            />
          ) : undefined
        }
      />

      <Card padding={4}>
        <div className="mb-md max-w-sm">
          <Selector
            label="Виберіть хост"
            value={selectedHost}
            onChange={(newHost) => navigate(`/gate/${encodeURIComponent(newHost)}`)}
            options={hostOptions.map((h) => ({ value: h, label: h === '*' ? '* (Глобальні правила)' : h }))}
          />
        </div>

        {gateData && (
          <VStack gap={4}>
            <div className="grid-responsive">
              <div className="p-md rounded-lg bg-subtle border-default">
                <div className="text-xs text-secondary mb-xs">
                  Shadow-правила на випробуванні
                </div>
                <div className={`text-xl text-bold ${gateData.shadow_rules_count > 0 ? 'text-yellow' : 'text-primary'}`}>
                  {gateData.shadow_rules_count}
                </div>
              </div>

              <div className="p-md rounded-lg bg-subtle border-default">
                <div className="text-xs text-secondary mb-xs">
                  Конфлікти правил
                </div>
                <div className={`text-xl text-bold ${gateData.unresolved_conflicts > 0 ? 'text-red' : 'text-green'}`}>
                  {gateData.unresolved_conflicts === 0 ? '0 (OK)' : `${gateData.unresolved_conflicts} нерозв'язано`}
                </div>
              </div>

              <div className="p-md rounded-lg bg-subtle border-default">
                <div className="text-xs text-secondary mb-xs">
                  Завершений успішний прогін
                </div>
                <div className={`text-lg text-bold ${gateData.has_completed_run ? 'text-green' : 'text-red'}`}>
                  {gateData.has_completed_run ? '✅ Зафіксовано' : '❌ Відсутній'}
                </div>
              </div>

              <div className="p-md rounded-lg bg-subtle border-default">
                <div className="text-xs text-secondary mb-xs">
                  Загальна статистика правил
                </div>
                <div className="text-sm">
                  <strong>Всього:</strong> {gateData.total_rules} |{' '}
                  <span className="text-green">Active: {gateData.active_rules}</span> |{' '}
                  <span className="text-tertiary">Retired: {gateData.retired_rules}</span>
                </div>
              </div>
            </div>

            <div className="border-top pt-md">
              <HStack justify="space-between" align="center">
                <div>
                  {gateData.ready_for_active ? (
                    <Text type="body" className="text-green text-semibold">
                      ✅ Всі умови виконано. Хост готовий до увімкнення правил!
                    </Text>
                  ) : (
                    <Text type="body" className="text-yellow text-semibold">
                      ⚠️ Увімкнення заблоковано до виконання всіх умов чек-листа.
                    </Text>
                  )}
                </div>

                <Button
                  variant="primary"
                  onClick={handleApprove}
                  disabled={!gateData.ready_for_active || submitting}
                >
                  {submitting ? 'Збереження...' : gateData.playbook_mode === 'active' ? 'Правила увімкнено (active)' : 'Увімкнути правила хоста'}
                </Button>
              </HStack>
            </div>
          </VStack>
        )}
      </Card>
    </VStack>
  );
};
