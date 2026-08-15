import React, { useState, useEffect } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { EmptyState, FormGrid } from '../ui/primitives';
import { Selector } from '@astryxdesign/core/Selector';
import { TextArea } from '@astryxdesign/core/TextArea';
import { REASON_CODE_LABELS, type ReasonCodeType, type HumanCorrection } from '../types/agent';
import type { SurveyStatus } from '../ui/tokens';

export interface AttentionCardProps {
  status: SurveyStatus;
  waitingVerification: boolean;
  reasonCode?: ReasonCodeType | string | null;
  questionText?: string | null;
  options?: string[];
  waitingSince?: string | null;
  onApprove: () => void;
  onCorrect: (correction: HumanCorrection) => void;
  onSkip: () => void;
  onPause: () => void;
  onResumeAfterCaptcha?: () => void;
  onAbortTask?: () => void;
}

export const AttentionCard: React.FC<AttentionCardProps> = ({
  status,
  waitingVerification,
  reasonCode: incomingReasonCode,
  questionText,
  options = [],
  waitingSince,
  onApprove,
  onCorrect,
  onSkip,
  onPause,
  onResumeAfterCaptcha,
  onAbortTask,
}) => {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [reasonCode, setReasonCode] = useState<ReasonCodeType>('wrong_element');
  const [overrideValue, setOverrideValue] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);

  const isCaptchaChallenge = incomingReasonCode === 'captcha_detected' || (questionText && questionText.startsWith('CAPTCHA:'));

  useEffect(() => {
    if (!waitingVerification) {
      setElapsedSec(0);
      return;
    }
    const start = waitingSince ? new Date(waitingSince).getTime() : Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [waitingVerification, waitingSince]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!waitingVerification && status !== 'waiting_auth') {
    return (
      <Card padding={3}>
        <EmptyState
          title="Агент працює автономно"
          description={status === 'running' ? 'Очікування наступного кроку або запиту на верифікацію' : 'Запустіть нове опитування через кнопку зверху'}
        />
      </Card>
    );
  }

  const handleSendCorrection = () => {
    onCorrect({
      kind: 'override_click',
      reason_code: reasonCode,
      override_value: overrideValue.trim() || undefined,
      note: correctionNote.trim() || undefined,
    });
    setIsCorrecting(false);
  };

  const reasonOptions = Object.entries(REASON_CODE_LABELS).map(([code, label]) => ({
    value: code,
    label,
  }));

  // Спеціальний режим: Детекція Капчі / Anti-bot Challenge (Feature 021C Part C)
  if (isCaptchaChallenge) {
    return (
      <Card padding={3}>
        <Banner
          variant="warning"
          title="🛑 Виявлено капчу / Cloudflare Challenge"
          description={`Агент призупинено для ручного вирішення оператором: ${formatElapsed(elapsedSec)}`}
        />

        <div className="mt-md text-sm text-secondary">
          Будь ласка, вирішіть капчу у вікні Viewport або браузері. Після проходження натисніть «Я вирішив / Продовжити» для автоматичного продовження опитування.
        </div>

        {questionText && (
          <div className="mt-sm text-xs text-mono text-tertiary">
            Сигнатура: {questionText}
          </div>
        )}

        <div className="flex-row gap-sm mt-lg flex-wrap">
          <Button variant="primary" onClick={onResumeAfterCaptcha || onApprove}>
            ✓ Я вирішив / Продовжити
          </Button>
          <Button variant="destructive" onClick={onAbortTask || onSkip}>
            ✕ Пропустити / Перервати
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding={3}>
      <Banner
        variant={status === 'waiting_auth' ? 'warning' : 'error'}
        title={status === 'waiting_auth' ? 'Потрібна авторизація оператора' : 'Потрібна верифікація рішення'}
        description={`Агент чекає на ваше підтвердження: ${formatElapsed(elapsedSec)}`}
      />

      {questionText && (
        <div className="mt-md text-base text-bold text-primary">
          {questionText}
        </div>
      )}

      {options.length > 0 && (
        <div className="mt-sm flex-col gap-xs">
          {options.map((opt, idx) => (
            <div key={idx} className="text-sm text-secondary">
              • {opt}
            </div>
          ))}
        </div>
      )}

      {!isCorrecting ? (
        <div className="flex-row gap-sm mt-lg flex-wrap">
          <Button variant="primary" onClick={onApprove}>
            ✓ Підтвердити дію
          </Button>
          <Button variant="secondary" onClick={() => setIsCorrecting(true)}>
            ✎ Виправити
          </Button>
          <Button variant="secondary" onClick={onSkip}>
            ⏭ Пропустити
          </Button>
          <Button variant="secondary" onClick={onPause}>
            ⏸ Пауза
          </Button>
        </div>
      ) : (
        <div className="mt-lg border-top pt-md">
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
              onChange={(val) => setOverrideValue(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
              placeholder="Введіть правильну відповідь або вкажіть дію"
            />
            <TextArea
              label="Коментар для тутора (optional)"
              value={correctionNote}
              onChange={(val) => setCorrectionNote(typeof val === 'string' ? val : (val as any)?.target?.value ?? '')}
              placeholder="Пояснення для запису уроку в базу знань"
            />
            <div className="flex-row gap-sm mt-sm">
              <Button variant="primary" onClick={handleSendCorrection}>
                Надіслати виправлення
              </Button>
              <Button variant="secondary" onClick={() => setIsCorrecting(false)}>
                Скасувати
              </Button>
            </div>
          </FormGrid>
        </div>
      )}
    </Card>
  );
};
