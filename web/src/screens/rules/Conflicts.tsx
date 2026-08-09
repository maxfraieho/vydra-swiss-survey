import React from 'react';
import { useResource } from '../../api/hooks';
import { RuleRow } from './RulesTable';
import { Markdown } from '../../ui/Markdown';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { HStack } from '@astryxdesign/core/HStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';

export interface ConflictGroup {
  host: string;
  persona: string;
  pattern: string;
  count: number;
  rules: RuleRow[];
}

export interface ConflictsResponse {
  count: number;
  conflicts: ConflictGroup[];
}

export const Conflicts: React.FC = () => {
  const { data, loading, error } = useResource<ConflictsResponse>('/api/rules/conflicts');

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Завантаження перевірки конфліктів джерел...
      </div>
    );
  }

  if (error) {
    return (
      <Card padding={5}>
        <Text type="body" style={{ color: '#f87171' }}>Помилка перевірки конфліктів: {error.message}</Text>
      </Card>
    );
  }

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <HStack justify="space-between" align="center">
          <div>
            <Heading level={2} style={{ marginBottom: '4px' }}>
              Конфлікти джерел знань (Source Conflicts)
            </Heading>
            <Text type="body" color="secondary" display="block">
              Групи (host, persona, pattern), які мають різну поведінку від різних джерел.
            </Text>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: data && data.count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${data && data.count > 0 ? '#dc2626' : '#059669'}`,
              color: data && data.count > 0 ? '#f87171' : '#34d399',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {data?.count || 0} Конфліктів
          </div>
        </HStack>
      </Card>

      {data && data.conflicts.length === 0 ? (
        <Card padding={5}>
          <Text type="body" display="block" style={{ textAlign: 'center', padding: '20px 0', color: '#34d399', fontWeight: 600 }}>
            ✅ Конфліктів між джерелами не виявлено. Усі правила узгоджені!
          </Text>
        </Card>
      ) : (
        <VStack gap={4}>
          {data?.conflicts.map((group, idx) => (
            <Card key={idx} padding={4}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#ef4444', color: '#fff', textTransform: 'uppercase' }}>
                  КОНФЛІКТ #{idx + 1}
                </span>
                <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 700 }}>
                  {group.host} • {group.persona} • <code style={{ color: '#38bdf8' }}>{group.pattern}</code>
                </span>
              </div>

              <Table hasHover density="compact">
                <TableHeader>
                  <TableRow isHeaderRow>
                    <TableHeaderCell style={{ width: '80px' }}>Rule ID</TableHeaderCell>
                    <TableHeaderCell style={{ width: '90px' }}>Джерело (Source)</TableHeaderCell>
                    <TableHeaderCell style={{ width: 'auto' }}>Поведінка (Behavior)</TableHeaderCell>
                    <TableHeaderCell style={{ width: '80px' }}>Status</TableHeaderCell>
                    <TableHeaderCell style={{ width: '50px' }}>Conf</TableHeaderCell>
                    <TableHeaderCell style={{ width: '80px' }}>Effective</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell style={{ fontFamily: 'monospace', color: '#94a3b8' }}>#{r.id}</TableCell>
                      <TableCell style={{ color: '#f8fafc', fontWeight: 600 }}>{r.source}</TableCell>
                      <TableCell style={{ whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                        <Markdown source={r.behavior} variant="compact" />
                      </TableCell>
                      <TableCell style={{ color: '#cbd5e1' }}>{r.status}</TableCell>
                      <TableCell style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{r.confidence}</TableCell>
                      <TableCell>
                        {r.effective ? (
                          <span style={{ color: '#60a5fa', fontWeight: 700 }}>✅ win</span>
                        ) : (
                          <span style={{ color: '#f87171' }}>⚠️ #{r.shadowed_by}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </VStack>
      )}
    </VStack>
  );
};
