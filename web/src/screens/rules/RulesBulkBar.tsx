import React from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';

export interface RulesBulkBarProps {
  selectedCount: number;
  bulkBusy: boolean;
  onBulkAction: (action: 'promote' | 'retire' | 'delete') => void;
  onClearSelection: () => void;
}

export const RulesBulkBar: React.FC<RulesBulkBarProps> = ({
  selectedCount,
  bulkBusy,
  onBulkAction,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <Card padding={3}>
      <div className="flex-between flex-wrap gap-sm">
        <div className="flex-row gap-sm items-center">
          <span className="text-sm text-bold text-primary">
            Вибрано правил: {selectedCount}
          </span>
          <Button variant="secondary" size="sm" onClick={onClearSelection}>
            Скинути
          </Button>
        </div>

        <div className="flex-row gap-xs">
          <Button
            variant="primary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => onBulkAction('promote')}
          >
            Активувати (Active)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => onBulkAction('retire')}
          >
            Retire (Застаріле)
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={bulkBusy}
            onClick={() => onBulkAction('delete')}
          >
            Видалити
          </Button>
        </div>
      </div>
    </Card>
  );
};
