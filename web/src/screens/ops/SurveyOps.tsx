import React, { useState } from 'react';
import { VStack } from '@astryxdesign/core/VStack';
import { Button } from '@astryxdesign/core/Button';
import { apiFetch, getApiBase } from '../../api/client';
import { usePolling } from '../../api/hooks';
import { PageHeader, useToast } from '../../ui/primitives';
import { AttentionCard } from '../../ops/AttentionCard';
import { AgentIntent } from '../../ops/AgentIntent';
import { Viewport } from '../../ops/Viewport';
import { StepTimeline, type StepItem } from '../../ops/StepTimeline';
import { RecentRuns, type RunItem } from '../../ops/RecentRuns';
import { LaunchForm } from '../../ops/LaunchForm';
import { TelegramQueueCard } from '../../ops/TelegramQueueCard';
import { ResumeTabCard } from '../../ops/ResumeTabCard';
import type { SurveyStatus } from '../../ui/tokens';
import type { HumanCorrection, TargetBBox, AgentActionType } from '../../types/agent';

interface RawSurveyStatus {
  status: SurveyStatus;
  url: string | null;
  reason_code?: string | null;
  pending_step: number | string | null;
  step_total?: number | null;
  total_steps?: number | null;
  pending_decision?: {
    action: string;
    target_text?: string;
    value?: string;
    target_bbox?: TargetBBox;
    confidence?: number;
    rationale?: string;
  } | null;
  log_history?: string[];
  waiting_seconds_remaining?: number;
  recent_runs?: RunItem[];
}

const parseStepLine = (line: string, idx: number): StepItem => {
  let text = line.trim();
  let timestamp: string | undefined;
  const timeMatch = text.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*/);
  if (timeMatch) {
    timestamp = timeMatch[1];
    text = text.slice(timeMatch[0].length);
  }
  const isError = /❌|error|fail|помилк/i.test(text);
  const isWarning = /⚠️|warn|увага/i.test(text);
  const isPause = /⏸️|pause|пауз|очікуван/i.test(text);
  const isSkip = /⏭️|skip|пропущ/i.test(text);
  const isCorrection = /✏️|правк|виправл|override|correct/i.test(text);
  const isSuccess = /✅|success|успішн|затвердж/i.test(text);

  let status = 'success';
  if (isError) status = 'error';
  else if (isCorrection) status = 'corrected';
  else if (isWarning) status = 'warning';
  else if (isPause) status = 'paused';
  else if (isSkip) status = 'skipped';
  else if (isSuccess) status = 'success';

  const parts = text.split(/\s+/);
  const action = parts[0] || 'step';
  const target = parts.length > 1 ? parts.slice(1).join(' ') : text;

  return {
    index: idx + 1,
    action,
    target,
    status,
    timestamp,
    hasCorrection: isCorrection,
  };
};

export const SurveyOps: React.FC = () => {
  const toast = useToast();
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  const [screenshotVersion, setScreenshotVersion] = useState(Date.now());
  const [isPointPickerMode, setIsPointPickerMode] = useState(false);

  const { data: statusData, reload: reloadStatus } = usePolling<RawSurveyStatus>('/api/survey/status', {
    intervalMs: 1500,
  });

  const currentStatus: SurveyStatus = statusData?.status || 'idle';
  const isWaiting = currentStatus === 'waiting_verification' || currentStatus === 'waiting_auth';

  const handleAction = async (action: 'approve' | 'skip' | 'pause' | 'correct', correction?: HumanCorrection) => {
    try {
      if (action === 'approve') {
        await apiFetch('/api/survey/approve', { method: 'POST' });
        toast.show({ variant: 'success', title: 'Дію підтверджено' });
      } else if (action === 'skip') {
        await apiFetch('/api/survey/skip', { method: 'POST' });
        toast.show({ variant: 'info', title: 'Крок пропущено' });
      } else if (action === 'pause') {
        await apiFetch('/api/survey/pause', { method: 'POST' });
        toast.show({ variant: 'warning', title: 'Сесію призупинено' });
      } else if (action === 'correct' && correction) {
        await apiFetch('/api/survey/override', {
          method: 'POST',
          body: JSON.stringify(correction),
        });
        toast.show({ variant: 'success', title: 'Правку надіслано до CoT агента' });
      }
      reloadStatus();
      setScreenshotVersion(Date.now());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка виконання дії', description: msg });
    }
  };

  const handleResumeCaptcha = async () => {
    try {
      await apiFetch('/api/survey/resume_after_captcha', { method: 'POST' });
      toast.show({ variant: 'success', title: 'Капчу пройдено, опитування продовжується' });
      reloadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка відновлення після капчі', description: msg });
    }
  };

  const handleAbortTask = async () => {
    try {
      await apiFetch('/api/survey/abort_task', { method: 'POST' });
      toast.show({ variant: 'warning', title: 'Опитування перервано' });
      reloadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show({ variant: 'error', title: 'Помилка зупинки опитування', description: msg });
    }
  };

  const handleLaunch = async (params: {
    url: string;
    personaId: string;
    browserSource: string;
    autonomous: boolean;
    trainingMode: boolean;
  }) => {
    await apiFetch('/api/survey/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    toast.show({ variant: 'success', title: 'Опитування успішно запущено' });
    reloadStatus();
  };

  const parsedSteps: StepItem[] = (statusData?.log_history || []).map(parseStepLine);

  const currentStepNum = typeof statusData?.pending_step === 'number'
    ? statusData.pending_step
    : (parsedSteps.length > 0 ? parsedSteps.length : null);

  const totalStepsNum = statusData?.step_total ?? statusData?.total_steps ?? (
    parsedSteps.length > 0 ? Math.max(parsedSteps.length, currentStepNum || 0) : null
  );

  const agentIntentData = statusData?.pending_decision
    ? {
        action: (statusData.pending_decision.action || 'click') as AgentActionType,
        target_selector: statusData.pending_decision.target_text || null,
        target_text: statusData.pending_decision.target_text || null,
        value: statusData.pending_decision.value || null,
        target_bbox: statusData.pending_decision.target_bbox || null,
        confidence: statusData.pending_decision.confidence ?? 0.85,
        rationale: statusData.pending_decision.rationale || 'Автоматичний вибір елемента за правилом',
      }
    : null;

  return (
    <VStack gap={4}>
      <PageHeader
        eyebrow="ОПЕРАЦІЇ"
        title="Пульт оператора"
        subtitle="HITL-навчання та онлайн-контроль проходження опитувань"
        actions={
          <div className="flex-row gap-sm">
            <Button variant="secondary" onClick={() => setIsPointPickerMode((p) => !p)}>
              {isPointPickerMode ? '🎯 Режим: Вказати точку (АКТИВНИЙ)' : '🎯 Вказати елемент'}
            </Button>
            <Button variant="primary" onClick={() => setIsLaunchOpen(true)}>
              ▶ Запустити опитування
            </Button>
          </div>
        }
      />

      {/* ЗОНА 1: HITL-картка уваги */}
      <AttentionCard
        status={currentStatus}
        waitingVerification={isWaiting}
        reasonCode={statusData?.reason_code}
        questionText={statusData?.pending_decision?.target_text}
        onApprove={() => handleAction('approve')}
        onCorrect={(corr) => handleAction('correct', corr)}
        onSkip={() => handleAction('skip')}
        onPause={() => handleAction('pause')}
        onResumeAfterCaptcha={handleResumeCaptcha}
        onAbortTask={handleAbortTask}
      />

      {agentIntentData && <AgentIntent intent={agentIntentData} />}

      {/* Черга опитувань з Telegram та Продовжити у відкритій вкладці */}
      <TelegramQueueCard onSurveyStarted={reloadStatus} />
      <ResumeTabCard onResumed={reloadStatus} />

      {/* ЗОНА 2: Інтерактивний Viewport + Таймлайн */}
      <Viewport
        screenshotSrc={`${getApiBase()}/api/survey/screenshot/latest?v=${screenshotVersion}`}
        url={statusData?.url}
        status={currentStatus}
        stepIndex={currentStepNum}
        stepTotal={totalStepsNum}
        targetBbox={statusData?.pending_decision?.target_bbox}
        isPointPickerMode={isPointPickerMode}
        onApprove={() => handleAction('approve')}
        onCorrect={(corr) => handleAction('correct', corr)}
        onPause={() => handleAction('pause')}
        onRefresh={() => {
          reloadStatus();
          setScreenshotVersion(Date.now());
        }}
      />

      <StepTimeline
        currentStep={currentStepNum || 1}
        totalSteps={totalStepsNum}
        steps={parsedSteps}
      />

      {/* ЗОНА 3: Останні прогони */}
      <RecentRuns runs={statusData?.recent_runs || []} />

      <LaunchForm
        isOpen={isLaunchOpen}
        onClose={() => setIsLaunchOpen(false)}
        onLaunch={handleLaunch}
      />
    </VStack>
  );
};
