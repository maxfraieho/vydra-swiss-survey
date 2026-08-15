import React from 'react';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { useIsNarrow } from '../shell/useIsNarrow';
import {
  statusBadgeVariant,
  statusLabel,
  ruleStatusVariant,
  outcomeVariant,
  type SurveyStatus,
  type RuleStatus,
  type RunOutcome,
} from './tokens';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}) => {
  const isNarrow = useIsNarrow();
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <div className={`flex-between ${isNarrow ? 'flex-col gap-md' : 'flex-row items-end gap-md'}`}>
          <VStack gap={1}>
            {eyebrow && (
              <Text type="supporting" color="secondary">
                {eyebrow}
              </Text>
            )}
            <Heading level={2}>{title}</Heading>
            {subtitle && (
              <Text type="supporting" color="secondary">
                {subtitle}
              </Text>
            )}
          </VStack>
          {actions && (
            <div className={`flex-row flex-wrap gap-sm ${isNarrow ? 'w-full' : 'justify-end'}`}>
              {actions}
            </div>
          )}
        </div>
        {children}
      </VStack>
    </Card>
  );
};

export interface MasterDetailProps {
  master?: React.ReactNode;
  list?: React.ReactNode;
  detail?: React.ReactNode | null;
  detailTitle?: string;
  detailSubtitle?: string;
  onCloseDetail?: () => void;
}

export const MasterDetail: React.FC<MasterDetailProps> = ({
  master,
  list,
  detail,
  detailTitle,
  detailSubtitle,
  onCloseDetail,
}) => {
  const isNarrow = useIsNarrow();
  const leftContent = master || list;
  const hasDetail = Boolean(detail);

  if (isNarrow) {
    return (
      <div className="flex-col gap-md">
        {leftContent}
        <Dialog
          isOpen={hasDetail}
          onClose={onCloseDetail || (() => {})}
        >
          <DialogHeader
            title={detailTitle || 'Деталі'}
          />
          <LayoutContent>{detail}</LayoutContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`grid-responsive gap-lg items-start ${hasDetail ? 'grid-cols-2' : ''}`}>
      <div className="min-w-0">{leftContent}</div>
      {hasDetail && <div className="min-w-0">{detail}</div>}
    </div>
  );
};

export interface FormGridProps {
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
}

export const FormGrid: React.FC<FormGridProps> = ({ columns = 2, children }) => {
  return (
    <div className={`grid-responsive gap-md ${columns === 1 ? 'grid-cols-1' : ''}`}>
      {children}
    </div>
  );
};

export const FormActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isNarrow = useIsNarrow();
  return (
    <div className={`flex-row gap-sm ${isNarrow ? 'flex-col' : 'justify-end'}`}>
      {children}
    </div>
  );
};

export const SurveyStatusPill: React.FC<{ status: SurveyStatus; suffix?: string | null }> = ({
  status,
  suffix,
}) => (
  <Badge
    variant={statusBadgeVariant[status] ?? 'neutral'}
    label={`${statusLabel[status] ?? status}${suffix ? ` (${suffix})` : ''}`}
  />
);

export const RuleStatusPill: React.FC<{ status: RuleStatus | string }> = ({ status }) => (
  <Badge variant={ruleStatusVariant[status as RuleStatus] ?? 'neutral'} label={status} />
);

export const OutcomePill: React.FC<{ outcome?: RunOutcome | string | null }> = ({ outcome }) => {
  const key = (outcome || 'unknown') as RunOutcome;
  return <Badge variant={outcomeVariant[key] ?? 'neutral'} label={outcome || 'невідомо'} />;
};

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
}

export const KeyValueList: React.FC<{ items: KeyValueItem[]; columns?: 1 | 2 }> = ({
  items,
  columns = 1,
}) => {
  const isNarrow = useIsNarrow();
  return (
    <MetadataList columns={isNarrow ? 1 : columns} label={{ position: 'start' }}>
      {items.map((it) => (
        <MetadataListItem key={it.label} label={it.label}>
          {it.value === null || it.value === undefined || it.value === '' ? '—' : it.value}
        </MetadataListItem>
      ))}
    </MetadataList>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <Card padding={5}>
    <VStack gap={2}>
      <Heading level={3}>{title}</Heading>
      {description && (
        <Text type="body" color="secondary">
          {description}
        </Text>
      )}
      {action && <HStack gap={2}>{action}</HStack>}
    </VStack>
  </Card>
);

export const ErrorState: React.FC<{ message: string; action?: React.ReactNode }> = ({
  message,
  action,
}) => (
  <Card padding={5}>
    <VStack gap={2}>
      <Text type="body" className="text-red">
        {message}
      </Text>
      {action && <HStack gap={2}>{action}</HStack>}
    </VStack>
  </Card>
);

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Завантаження…' }) => (
  <Card padding={5}>
    <Text type="body" color="secondary">
      {label}
    </Text>
  </Card>
);
