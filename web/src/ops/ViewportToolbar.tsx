import React, { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';

export interface ViewportToolbarProps {
  loading: boolean;
  onType: (text: string) => void;
  onKey: (key: string) => void;
  onScroll: (dy: number) => void;
}

export const ViewportToolbar: React.FC<ViewportToolbarProps> = ({
  loading,
  onType,
  onKey,
  onScroll,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      onType(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex-row gap-sm mt-sm flex-wrap items-center">
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputText.trim()) {
            handleSend();
          }
        }}
        placeholder="Введіть текст або капчу для сторінки..."
        className="input-standard flex-1 min-w-0"
        style={{ minWidth: '200px' }}
      />
      <Button
        size="sm"
        variant="primary"
        disabled={loading || !inputText.trim()}
        onClick={handleSend}
      >
        Ввести
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onKey('Enter')}>
        ↵ Enter
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onKey('Tab')}>
        ⇥ Tab
      </Button>
      <Button size="sm" variant="secondary" onClick={() => onScroll(350)}>
        ⬇ 350px
      </Button>
    </div>
  );
};
