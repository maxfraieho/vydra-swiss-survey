import React, { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { FormGrid, normalizeInputChange } from '../ui/primitives';
import { REASON_CODE_LABELS, type ReasonCodeType, type HumanCorrection } from '../types/agent';

export interface ViewportCorrectionFormProps {
  onSubmit: (correction: HumanCorrection) => void;
  onCancel: () => void;
}

export const ViewportCorrectionForm: React.FC<ViewportCorrectionFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [reasonCode, setReasonCode] = useState<ReasonCodeType>('wrong_element');
  const [overrideValue, setOverrideValue] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');

  const handleSend = () => {
    onSubmit({
      kind: 'override_click',
      reason_code: reasonCode,
      override_value: overrideValue.trim() || undefined,
      note: correctionNote.trim() || undefined,
    });
  };

  const reasonOptions = Object.entries(REASON_CODE_LABELS).map(([code, label]) => ({
    value: code,
    label,
  }));

  return (
    <div className="mt-sm pt-sm border-top">
      <FormGrid columns={1}>
        <Selector
          label="Причина правки (reason_code)"
          value={reasonCode}
          onChange={(val) => setReasonCode(val as ReasonCodeType)}
          options={reasonOptions}
        />
        <TextArea
          label="Правильне значення або селектор"
          value={overrideValue}
          onChange={(val) => setOverrideValue(normalizeInputChange(val))}
          placeholder="Введіть правильну відповідь або вкажіть дію"
        />
        <TextArea
          label="Коментар для тутора (optional)"
          value={correctionNote}
          onChange={(val) => setCorrectionNote(normalizeInputChange(val))}
          placeholder="Пояснення для запису уроку в базу знань"
        />
        <div className="flex-row gap-sm mt-xs">
          <Button variant="primary" size="sm" onClick={handleSend}>
            Надіслати виправлення
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Скасувати
          </Button>
        </div>
      </FormGrid>
    </div>
  );
};
