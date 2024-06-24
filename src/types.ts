export type StepData = {
  percent: number;
  averageCompletionTimeInMs: number;
  message: string;
};

export type DelayReason = 'normal' | 'unexpected' | undefined;
