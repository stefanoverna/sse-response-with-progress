import { ProgressTracker } from './ProgressTracker';
import buildDeferred from './buildDeferred';
import type { DelayReason, StepData } from './types';

export type EventSourceStatus = 'init' | 'open' | 'closed' | 'error' | 'finish';

export function performWithProgress<T>(
  url: string,
  onProgressChange: (percent: number) => void,
  onMessageChange: (message: string | undefined) => void,
  onDelayReason: (reason: DelayReason) => void,
): Promise<T> {
  const deferred = buildDeferred<T>();

  const es = new EventSource(url);

  const tracker = new ProgressTracker();

  const intervalId = setInterval(() => {
    onProgressChange(tracker.currentPercent());
    onDelayReason(tracker.delayReason());
  }, 200);

  function terminate() {
    es.close();
    clearInterval(intervalId);
  }

  es.addEventListener('error', (error) => {
    terminate();
    deferred.reject(error);
  });

  es.addEventListener('requestError', (eventMessage: MessageEvent<string>) => {
    terminate();
    const error = JSON.parse(eventMessage.data);
    deferred.reject(error);
  });

  es.addEventListener('step', (eventMessage: MessageEvent<string>) => {
    const step = JSON.parse(eventMessage.data) as StepData;
    tracker.addStep(step);
    onDelayReason(undefined);
    onMessageChange(step.message);
  });

  es.addEventListener('return', (eventMessage: MessageEvent<string>) => {
    terminate();
    const result = JSON.parse(eventMessage.data) as T;
    onProgressChange(100);
    onMessageChange(undefined);
    deferred.resolve(result);
  });

  return deferred.promise;
}
