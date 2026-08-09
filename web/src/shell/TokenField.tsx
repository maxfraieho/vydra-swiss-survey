import React, { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
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
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const submit = () => {
    if (!draft.trim()) return;
    setAstryxToken(draft.trim(), true);
    setToken(draft.trim());
    setDraft('');
    setDialogOpen(false);
  };

  if (isNarrow) {
    return (
      <div style={{ marginLeft: 'auto' }}>
        <Button label="🔑" variant="ghost" size="sm" onClick={() => setDialogOpen(true)} />
        <Dialog isOpen={dialogOpen} onOpenChange={setDialogOpen} variant="standard" width={320} purpose="form">
          <Layout
            header={<DialogHeader title="X-Astryx-Token" onOpenChange={setDialogOpen} />}
            content={
              <LayoutContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <TextInput
                    type="password"
                    label="X-Astryx-Token"
                    value={draft}
                    onChange={(value) => setDraft(value)}
                    placeholder="X-Astryx-Token"
                  />
                  <Button type="submit" label="OK" variant="primary" />
                </form>
              </LayoutContent>
            }
          />
        </Dialog>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
    >
      <TextInput
        type="password"
        label="X-Astryx-Token"
        isLabelHidden
        value={draft}
        onChange={(value) => setDraft(value)}
        placeholder="X-Astryx-Token"
        size="sm"
      />
      <Button type="submit" label="OK" variant="primary" size="sm" />
    </form>
  );
};
