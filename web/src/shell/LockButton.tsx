import React from 'react';
import { Button } from '@astryxdesign/core/Button';

export const LockButton: React.FC = () => {
  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      .finally(() => {
        location.reload();
      });
  };

  return (
    <div style={{ marginLeft: 'auto' }}>
      <Button
        label="🔒 Вийти"
        variant="ghost"
        size="sm"
        onClick={handleLogout}
      />
    </div>
  );
};
