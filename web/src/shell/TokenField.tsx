import React, { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { getAstryxToken, setAstryxToken, clearAstryxToken } from '../api/token';
import { useIsNarrow } from './useIsNarrow';

// Single-operator token entry: apiFetch (api/client.ts) already attaches
// X-Astryx-Token from getAstryxToken() to every request. Nothing in the UI
// ever called setAstryxToken, so the header was always empty and every
// mutating request 401'd. This is the one place that fills it in.
export const TokenField: React.FC = () => {
  const isNarrow = useIsNarrow();
  const [token, setToken] = useState<string | null>(() => getAstryxToken());
  const [draft, setDraft] = useState('');

  if (token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
        <Badge variant="success" label={isNarrow ? '🔑' : '🔑 токен активний'} />
        <Button
          label="вийти"
          variant="ghost"
          size="sm"
          onClick={() => {
            clearAstryxToken();
            setToken(null);
          }}
        />
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
      <TextInput
        type="password"
        label="X-Astryx-Token"
        isLabelHidden
        value={draft}
        onChange={(value) => setDraft(value)}
        placeholder={isNarrow ? 'Токен' : 'X-Astryx-Token'}
        size="sm"
        width={isNarrow ? '80px' : undefined}
      />
      <Button type="submit" label="OK" variant="primary" size="sm" />
    </form>
  );
};
