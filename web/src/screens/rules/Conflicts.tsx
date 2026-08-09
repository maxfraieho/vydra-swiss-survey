import React from 'react';
import { useResource } from '../../api/hooks';
import { RuleRow } from './RulesTable';
import { Markdown } from '../../ui/Markdown';
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from '@astryxdesign/core/Table';

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
      <div style={{ padding: '20px', color: '#f87171', fontSize: '13px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}>
        Помилка перевірки конфліктів: {error.message}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
              Конфлікти джерел знань (Source Conflicts)
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
              Групи (host, persona, pattern), які мають різну поведінку від різних джерел.
            </p>
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
        </div>
      </div>

      {data && data.conflicts.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#34d399', fontSize: '14px', fontWeight: 600 }}>
          ✅ Конфліктів між джерелами не виявлено. Усі правила узгоджені!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data?.conflicts.map((group, idx) => (
            <div key={idx} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '16px' }}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
