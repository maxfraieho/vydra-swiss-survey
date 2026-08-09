import React from 'react';
import { useResource } from '../../api/hooks';
import { Markdown } from '@astryxdesign/core/Markdown';
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
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Генерація Markdown/Mermaid звіту правил...
      </div>
    );
  }

  if (error) {
    return (
      <Card padding={5}>
        <Text type="body" style={{ color: '#f87171' }}>Помилка завантаження звіту: {error.message}</Text>
      </Card>
    );
  }

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <Heading level={2}>Звіт про стан системи знань (Knowledge Report)</Heading>
        <Text type="supporting" color="secondary">
          Згенеровано автоматично через API U0 (<code style={{ color: '#38bdf8' }}>rules_report.py</code>).
        </Text>
      </Card>

      <Card padding={6}>
        <Card variant="muted" padding={5}>
          {reportMd && reportMd.trim() !== '' ? (
            <Markdown headingLevelStart={4} components={MARKDOWN_COMPONENTS}>{reportMd}</Markdown>
          ) : (
            <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>Звіт порожній.</span>
          )}
        </Card>
      </Card>
    </VStack>
  );
};
