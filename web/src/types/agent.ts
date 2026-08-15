export type SurveyStatusType =
  | 'idle'
  | 'running'
  | 'starting'
  | 'waiting_auth'
  | 'waiting_verification'
  | 'paused'
  | 'completed'
  | 'error';

export type AgentActionType =
  | 'click'
  | 'type'
  | 'select'
  | 'navigate'
  | 'wait'
  | 'captcha_solve'
  | 'done';

export type ReasonCodeType =
  | 'captcha_detected'
  | 'wrong_element'
  | 'missed_captcha'
  | 'bad_value'
  | 'stuck_navigation'
  | 'premature_action'
  | 'other';

export const REASON_CODE_LABELS: Record<ReasonCodeType, string> = {
  captcha_detected: 'Виявлено капчу / bot-filter (captcha_detected)',
  wrong_element: 'Не той елемент (wrong_element)',
  missed_captcha: 'Пропущена / не розпізнана капча (missed_captcha)',
  bad_value: 'Невірне значення або формат (bad_value)',
  stuck_navigation: 'Застряг на навігації / переході (stuck_navigation)',
  premature_action: 'Передчасна дія (сторінка не завантажилась) (premature_action)',
  other: 'Інша причина (other)',
};

export interface TargetBBox {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
}

export interface AgentIntent {
  action: AgentActionType;
  target_selector?: string | null;
  target_text?: string | null;
  value?: string | null;
  target_bbox?: TargetBBox | null;
  confidence: number; // 0..1
  rationale: string;
}

export interface NormalizedPoint {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
}

export interface HumanCorrection {
  kind: 'approve' | 'override_click' | 'override_type' | 'skip' | 'pause';
  reason_code: ReasonCodeType;
  point?: NormalizedPoint | null;
  override_value?: string | null;
  note?: string | null;
}

export interface AgentFrame {
  frame_id: string;
  url: string;
  step_index: number;
  step_total?: number | null;
  status: SurveyStatusType;
  agent_intent: AgentIntent;
  human_correction?: HumanCorrection | null;
}

export function validateAgentFrame(raw: unknown): { valid: boolean; frame?: AgentFrame; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Кадр агента має бути об’єктом' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.url !== 'string') {
    return { valid: false, error: 'Поле url обов’язкове (string)' };
  }
  const frameId = typeof obj.frame_id === 'string' ? obj.frame_id : `frame_${Date.now()}`;
  const stepIndex = typeof obj.step_index === 'number' ? obj.step_index : 0;
  const status = (typeof obj.status === 'string' ? obj.status : 'idle') as SurveyStatusType;

  const rawIntent = (obj.agent_intent && typeof obj.agent_intent === 'object' ? obj.agent_intent : {}) as Record<string, unknown>;
  const action = (typeof rawIntent.action === 'string' ? rawIntent.action : 'click') as AgentActionType;
  const confidence = typeof rawIntent.confidence === 'number' ? Math.max(0, Math.min(1, rawIntent.confidence)) : 1;
  const rationale = typeof rawIntent.rationale === 'string' ? rawIntent.rationale : '';

  let targetBbox: TargetBBox | null = null;
  if (rawIntent.target_bbox && typeof rawIntent.target_bbox === 'object') {
    const b = rawIntent.target_bbox as Record<string, unknown>;
    if (typeof b.x === 'number' && typeof b.y === 'number' && typeof b.w === 'number' && typeof b.h === 'number') {
      targetBbox = { x: b.x, y: b.y, w: b.w, h: b.h };
    }
  }

  const frame: AgentFrame = {
    frame_id: frameId,
    url: obj.url,
    step_index: stepIndex,
    step_total: typeof obj.step_total === 'number' ? obj.step_total : null,
    status,
    agent_intent: {
      action,
      target_selector: typeof rawIntent.target_selector === 'string' ? rawIntent.target_selector : null,
      target_text: typeof rawIntent.target_text === 'string' ? rawIntent.target_text : null,
      value: typeof rawIntent.value === 'string' ? rawIntent.value : null,
      target_bbox: targetBbox,
      confidence,
      rationale,
    },
  };

  return { valid: true, frame };
}
