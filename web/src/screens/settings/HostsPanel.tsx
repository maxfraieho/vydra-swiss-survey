import React, { useState } from 'react';
import { useResource } from '../../api/hooks';
import { HostRow, ProviderRow, createHost, deleteHost } from '../../api/settings';

export const HostsPanel: React.FC = () => {
  const { data: hosts, loading: hostsLoading, error: hostsError, refetch: refetchHosts } =
    useResource<HostRow[]>('/api/settings/hosts');

  const { data: providers } = useResource<ProviderRow[]>('/api/settings/providers');

  const [hostname, setHostname] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [providerId, setProviderId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState<boolean>(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    setSubmitError(null);

    const trimmedHostname = hostname.trim();
    if (!trimmedHostname) {
      setSubmitError("Будь ласка, вкажіть назву хоста (hostname)");
      return;
    }

    setSubmitting(true);
    try {
      await createHost({
        hostname: trimmedHostname,
        label: label.trim() || undefined,
        provider_id: providerId ? parseInt(providerId, 10) : undefined,
        note: note.trim() || undefined,
      });
      setHostname('');
      setLabel('');
      setProviderId('');
      setNote('');
      setAttemptedSubmit(false);
      refetchHosts();
    } catch (err: any) {
      setSubmitError(err?.message || 'Не вдалося створити хост');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (host: HostRow) => {
    if (!window.confirm(`Вилучити хост "${host.hostname}"?`)) {
      return;
    }
    try {
      await deleteHost(host.id);
      refetchHosts();
    } catch (err: any) {
      alert(`Помилка вилучення: ${err?.message || err}`);
    }
  };

  const providerMap = new Map<number, ProviderRow>();
  if (providers) {
    for (const p of providers) {
      providerMap.set(p.id, p);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Table Card */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
            Хости ({hosts?.length || 0})
          </h3>
          {hostsLoading && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Завантаження...</span>}
        </div>

        {hostsError && (
          <div style={{ padding: '16px 20px', color: '#f87171', fontSize: '13px' }}>
            ⚠️ Помилка завантаження хостів: {hostsError.message}
          </div>
        )}

        {!hostsLoading && hosts && hosts.length === 0 && (
          <div style={{ padding: '24px 20px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
            Хости відсутні. Створіть перший хост за допомогою форми нижче.
          </div>
        )}

        {hosts && hosts.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#020617', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>ID</th>
                  <th style={{ padding: '10px 14px' }}>Hostname</th>
                  <th style={{ padding: '10px 14px' }}>Label</th>
                  <th style={{ padding: '10px 14px' }}>Провайдер</th>
                  <th style={{ padding: '10px 14px' }}>Примітка</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Дії</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => {
                  const prov = h.provider_id ? providerMap.get(h.provider_id) : null;
                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#94a3b8' }}>#{h.id}</td>
                      <td style={{ padding: '10px 14px', color: '#f8fafc', fontWeight: 600 }}>{h.hostname}</td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{h.label || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                        {prov ? prov.label || prov.key : h.provider_id ? `#${h.provider_id}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>{h.note || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(h)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: '1px solid #dc2626',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#f87171',
                          }}
                        >
                          Вилучити
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation Form Card */}
      <form
        onSubmit={handleCreate}
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
          + Додати хост
        </h4>

        {submitError && (
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #dc2626',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
            }}
          >
            ⚠️ {submitError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Hostname <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="e.g. example.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: attemptedSubmit && !hostname.trim() ? '1px solid #f87171' : '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {attemptedSubmit && !hostname.trim() && (
              <span style={{ fontSize: '11px', color: '#f87171' }}>Обов'язкове поле</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Label (Назва)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Example Survey Panel"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Провайдер
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">— без провайдера —</option>
              {providers?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
              Примітка (Note)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Короткий коментар..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
              border: '1px solid #38bdf8',
              background: '#1e293b',
              color: '#38bdf8',
              transition: 'all 0.15s ease',
            }}
          >
            {submitting ? 'Збереження...' : 'Створити хост'}
          </button>
        </div>
      </form>
    </div>
  );
};
