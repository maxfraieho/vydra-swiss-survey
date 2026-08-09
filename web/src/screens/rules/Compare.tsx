import React, { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useResource } from '../../api/hooks';
import { RuleRow } from './RulesTable';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/VStack';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';

export interface CompareResult {
  pattern: string;
  count: number;
  rules: RuleRow[];
}

export const Compare: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const patternParam = searchParams.get('pattern') || '';
  const [inputPattern, setInputPattern] = useState(patternParam);

  const endpoint = patternParam ? `/api/rules/compare?pattern=${encodeURIComponent(patternParam)}` : null;
  const { data, loading, error } = useResource<CompareResult>(endpoint);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPattern.trim()) {
      setSearchParams({ pattern: inputPattern.trim() });
    } else {
      setSearchParams({});
    }
  };

  return (
    <VStack gap={5}>
      <Card padding={5}>
        <Heading level={2} style={{ marginBottom: '8px' }}>
          Порівняння патернів правил (Compare)
        </Heading>
        <Text type="body" color="secondary" display="block" style={{ marginBottom: '16px' }}>
          Порівняйте поведінку одного патерну між різними хостами, профайлами та джерелами.
        </Text>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Введіть exact pattern (наприклад: q_income_swiss)..."
            value={inputPattern}
            onChange={(e) => setInputPattern(e.target.value)}
            style={{
              flex: 1,
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#f8fafc',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Порівняти
          </button>
        </form>
      </Card>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Завантаження порівняння для "{patternParam}"...
        </div>
      )}

      {error && (
        <Card padding={5}>
          <Text type="body" style={{ color: '#f87171' }}>Помилка порівняння: {error.message}</Text>
        </Card>
      )}

      {!patternParam && (
        <Card padding={5}>
          <Text type="body" color="secondary" display="block" style={{ textAlign: 'center', padding: '20px 0' }}>
            💡 Введіть назву патерну у полі вище для порівняння.
          </Text>
        </Card>
      )}

      {data && (
        <Card padding={0}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
            <Heading level={3} style={{ fontSize: '15px' }}>
              Результати для патерну "{data.pattern}" ({data.count} правил)
            </Heading>
          </div>

          {data.rules.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Жодного правила не знайдено для цього патерну.
            </div>
          ) : (
            <Table hasHover density="compact">
              <TableHeader>
                <TableRow isHeaderRow>
                  <TableHeaderCell style={{ width: '50px' }}>ID</TableHeaderCell>
                  <TableHeaderCell style={{ width: '90px' }}>Хост</TableHeaderCell>
                  <TableHeaderCell style={{ width: '80px' }}>Персона</TableHeaderCell>
                  <TableHeaderCell style={{ width: 'auto' }}>Поведінка (Behavior)</TableHeaderCell>
                  <TableHeaderCell style={{ width: '80px' }}>Джерело</TableHeaderCell>
                  <TableHeaderCell style={{ width: '90px' }}>Статус</TableHeaderCell>
                  <TableHeaderCell style={{ width: '70px' }}>Ефект</TableHeaderCell>
                  <TableHeaderCell style={{ width: '50px' }}>Conf</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell style={{ fontFamily: 'monospace', color: '#94a3b8' }}>#{r.id}</TableCell>
                    <TableCell style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.host}</TableCell>
                    <TableCell style={{ color: '#e2e8f0' }}>{r.persona}</TableCell>
                    <TableCell style={{ whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                      <Markdown density="compact" headingLevelStart={4}>{r.behavior}</Markdown>
                    </TableCell>
                    <TableCell style={{ color: '#cbd5e1' }}>{r.source}</TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: r.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: r.status === 'active' ? '#34d399' : '#fbbf24',
                        }}
                      >
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.effective ? (
                        <span style={{ fontSize: '11px', color: '#60a5fa' }}>✅ win</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#f87171' }}>⚠️ #{r.shadowed_by}</span>
                      )}
                    </TableCell>
                    <TableCell style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{r.confidence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </VStack>
  );
};
