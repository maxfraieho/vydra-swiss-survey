import React from 'react';
import { useResource } from '../../api/hooks';
import { DetailsMarkdown } from '../../ui/DetailsMarkdown';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';
import { MermaidTree } from '../../ui/MermaidTree';
import { VStack } from '@astryxdesign/core/VStack';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';

const ReportCode: React.FC<{ code: string; language?: string }> = ({ code, language }) =>
  language === 'mermaid' ? <MermaidTree src={code} /> : <CodeBlock code={code} language={language} isCollapsible />;

const MARKDOWN_COMPONENTS = { code: ReportCode };

export const Report: React.FC = () => {
  const { data: reportMd, loading, error } = useResource<string>('/api/rules/report.md');

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '13px' }}>
        Генерація Markdown/Mermaid звіту правил...
      </div>
    );
  }

  if (error) {
    return (
      <Card padding={5}>
        <Text type="body" style={{ color: 'var(--color-text-red)' }}>Помилка завантаження звіту: {error.message}</Text>
      </Card>
    );
  }

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <Heading level={2}>Звіт про стан системи знань (Knowledge Report)</Heading>
        <Text type="supporting" color="secondary">
          Згенеровано автоматично через API U0 (<code style={{ color: 'var(--color-accent)' }}>rules_report.py</code>).
        </Text>
      </Card>

      <Card padding={6}>
        <Card variant="muted" padding={5}>
          {reportMd && reportMd.trim() !== '' ? (
            <DetailsMarkdown headingLevelStart={4} components={MARKDOWN_COMPONENTS}>{reportMd}</DetailsMarkdown>
          ) : (
            <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic', fontSize: '13px' }}>Звіт порожній.</span>
          )}
        </Card>
      </Card>
    </VStack>
  );
};
