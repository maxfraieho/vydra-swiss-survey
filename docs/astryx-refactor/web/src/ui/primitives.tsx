/**
 * Локальний шар примітивів над @astryxdesign/core.
 *
 * Призначення: прибрати повторювані патерни, через які в екранах
 * відроджуються inline-стилі. Це ЄДИНИЙ файл (крім `theme/**`), де дозволено
 * писати `style={{}}` — і лише для геометрії (grid/flex/розміри), не для
 * кольорів і типографіки.
 *
 * Імена навмисно не конфліктують з Astryx: `Section` уже існує в
 * @astryxdesign/core, тому наш заголовок екрана — `PageHeader`.
 */
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
  DETAIL_WIDTH_PX,
  space,
  statusBadgeVariant,
  statusLabel,
  ruleStatusVariant,
  outcomeVariant,
  type SurveyStatus,
  type RuleStatus,
  type RunOutcome,
} from './tokens';

/* ------------------------------------------------------------------ */
/* PageHeader — заголовок екрана: eyebrow + назва + дії справа         */
/* ------------------------------------------------------------------ */

export interface PageHeaderProps {
  /** Дрібний надзаголовок, напр. "КЕРУВАННЯ". Без емодзі. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Кнопки/фільтри праворуч (на вузькому екрані переносяться вниз). */
  actions?: React.ReactNode;
  /** Додатковий рядок під заголовком (табі, пошук). */
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
        <div
          style={{
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            alignItems: isNarrow ? 'stretch' : 'flex-end',
            justifyContent: 'space-between',
            gap: space.md,
          }}
        >
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
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: space.sm,
                justifyContent: isNarrow ? 'stretch' : 'flex-end',
              }}
            >
              {actions}
            </div>
          )}
        </div>
        {children}
      </VStack>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* MasterDetail — список + деталь; на телефоні деталь стає Dialog      */
/* ------------------------------------------------------------------ */

export interface MasterDetailProps {
  list: React.ReactNode;
  /** Вміст деталі. Якщо null — показується лише список. */
  detail?: React.ReactNode | null;
  detailTitle?: string;
  detailSubtitle?: string;
  onCloseDetail?: () => void;
  detailWidthPx?: number;
}

/**
 * Замінює всі варіації `gridTemplateColumns: '1fr 420px'`.
 * Широкий екран — дві колонки; вузький — список на всю ширину, а деталь
 * у повноекранному Dialog (той самий патерн, що вже застосований у
 * `TraceDetail`).
 */
export const MasterDetail: React.FC<MasterDetailProps> = ({
  list,
  detail,
  detailTitle,
  detailSubtitle,
  onCloseDetail,
  detailWidthPx = DETAIL_WIDTH_PX,
}) => {
  const isNarrow = useIsNarrow();
  const hasDetail = Boolean(detail);

  if (isNarrow) {
    return (
      <>
        {list}
        <Dialog
          isOpen={hasDetail}
          onOpenChange={(open: boolean) => {
            if (!open) onCloseDetail?.();
          }}
        >
          <Layout
            header={
              <DialogHeader
                title={detailTitle || 'Деталі'}
                subtitle={detailSubtitle}
                onOpenChange={(open: boolean) => {
                  if (!open) onCloseDetail?.();
                }}
              />
            }
          >
            <LayoutContent>{detail}</LayoutContent>
          </Layout>
        </Dialog>
      </>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: hasDetail ? `minmax(0, 1fr) ${detailWidthPx}px` : 'minmax(0, 1fr)',
        gap: space.lg,
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>{list}</div>
      {hasDetail && <div style={{ minWidth: 0 }}>{detail}</div>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* FormGrid — адаптивна сітка полів форми                              */
/* ------------------------------------------------------------------ */

export interface FormGridProps {
  /** Кількість колонок на широкому екрані. На вузькому — завжди 1. */
  columns?: 2 | 3;
  children: React.ReactNode;
}

/** Замінює всі `gridTemplateColumns: '1fr 1fr'` у панелях налаштувань. */
export const FormGrid: React.FC<FormGridProps> = ({ columns = 2, children }) => {
  const isNarrow = useIsNarrow();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr' : `repeat(${columns}, minmax(0, 1fr))`,
        gap: space.md,
      }}
    >
      {children}
    </div>
  );
};

/** Рядок кнопок форми, вирівняний праворуч (на телефоні — на всю ширину). */
export const FormActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isNarrow = useIsNarrow();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isNarrow ? 'column' : 'row',
        justifyContent: 'flex-end',
        gap: space.sm,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* StatusPill — єдиний мапінг стану у Badge                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* KeyValueList — метадані замість сітки 1fr 1fr                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* EmptyState / ErrorState — замість сирих рядків тексту               */
/* ------------------------------------------------------------------ */

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
      <Text type="body" style={{ color: 'var(--color-text-red)' }}>
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

/* ------------------------------------------------------------------ */
/* DataList — «таблиця», що на телефоні стає карточками                */
/* ------------------------------------------------------------------ */

export interface DataListColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Показувати у згорнутому (мобільному) вигляді. За замовчуванням так. */
  compact?: boolean;
}

export interface DataListProps<T> {
  rows: T[];
  columns: DataListColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Один компонент замість 8 самописних `<table>` з `overflowX:auto`.
 * Широкий екран — таблиця; вузький — `ClickableCard` + `KeyValueList`
 * (патерн, який уже використано у `Traces`/`HostsPanel`).
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  emptyTitle = 'Немає даних',
  emptyDescription,
}: DataListProps<T>) {
  const isNarrow = useIsNarrow();

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  if (isNarrow) {
    const compactCols = columns.filter((c) => c.compact !== false);
    return (
      <VStack gap={2}>
        {rows.map((row) => {
          const key = rowKey(row);
          const first = compactCols[0];
          return (
            <Card
              key={key}
              padding={3}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              <VStack gap={2}>
                {first && <Heading level={4}>{first.render(row)}</Heading>}
                <KeyValueList
                  items={compactCols.slice(1).map((c) => ({ label: c.header, value: c.render(row) }))}
                />
              </VStack>
            </Card>
          );
        })}
      </VStack>
    );
  }

  return (
    <Card padding={0}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: 'left', padding: space.md }}>
                <Text type="supporting" color="secondary">
                  {c.header}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                aria-selected={selectedKey === key}
                style={{
                  cursor: onRowClick ? 'pointer' : undefined,
                  background: selectedKey === key ? 'var(--color-background-muted)' : undefined,
                  borderTop: '1px solid var(--color-border-subtle)',
                }}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: space.md, verticalAlign: 'top' }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
