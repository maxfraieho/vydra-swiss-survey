import React from 'react';
import { useResource } from '../../api/hooks';
import { DetailsMarkdown } from '../../ui/DetailsMarkdown';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { MermaidTree } from '../../ui/MermaidTree';
import { VStack } from '@astryxdesign/core/VStack';
import { Card } from '@astryxdesign/core/Card';
import { PageHeader, EmptyState } from '../../ui/primitives';

const ReportCode: React.FC<{ code: string; language?: string }> = ({ code, language }) =>
  language === 'mermaid' ? <MermaidTree src={code} /> : <CodeBlock code={code} language={language} isCollapsible />;

const MARKDOWN_COMPONENTS = { code: ReportCode };

export const Report: React.FC = () => {
  const { data: reportMd, loading, error } = useResource<string>('/api/rules/report.md');

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="ЗВІТ"
        title="Звіт про стан системи знань (Knowledge Report)"
        subtitle="Згенеровано автоматично через API U0 (rules_report.py)"
      />

      {loading && (
        <Card padding={4}>
          <div className="p-lg text-center text-xs text-tertiary">
            Генерація Markdown/Mermaid звіту правил...
          </div>
        </Card>
      )}

      {error && (
        <Card padding={4}>
          <EmptyState
            title="Помилка завантаження звіту"
            description={error.message}
          />
        </Card>
      )}

      {!loading && !error && (
        <Card padding={4}>
          {reportMd && reportMd.trim() !== '' ? (
            <DetailsMarkdown headingLevelStart={4} components={MARKDOWN_COMPONENTS}>
              {reportMd}
            </DetailsMarkdown>
          ) : (
            <EmptyState
              title="Звіт порожній"
              description="У базі знань ще немає правил для формування графу."
            />
          )}
        </Card>
      )}
    </VStack>
  );
};
