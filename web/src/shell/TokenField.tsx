import React, { useState } from 'react';
import { getAstryxToken, setAstryxToken, clearAstryxToken } from '../api/token';

// Single-operator token entry: apiFetch (api/client.ts) already attaches
// X-Astryx-Token from getAstryxToken() to every request. Nothing in the UI
// ever called setAstryxToken, so the header was always empty and every
// mutating request 401'd. This is the one place that fills it in.
export const TokenField: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => getAstryxToken());
  const [draft, setDraft] = useState('');

  if (token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
        <span style={{ fontSize: '12px', color: '#4ade80' }}>🔑 токен активний</span>
        <button
          onClick={() => {
            clearAstryxToken();
            setToken(null);
          }}
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            background: 'transparent',
            border: '1px solid #334155',
            borderRadius: '4px',
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          вийти
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setAstryxToken(draft.trim(), true);
        setToken(draft.trim());
        setDraft('');
      }}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
    >
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="X-Astryx-Token"
        style={{
          fontSize: '12px',
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '4px',
          padding: '4px 8px',
          color: '#e2e8f0',
          width: '140px',
        }}
      />
      <button
        type="submit"
        style={{
          fontSize: '11px',
          color: '#e2e8f0',
          background: '#334155',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
        }}
      >
        OK
      </button>
    </form>
  );
};
