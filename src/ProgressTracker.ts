import type { DelayReason, StepData } from './types';

export class ProgressTracker {
  private committedPercent = 0;
  private inProgressOperation: { step: StepData; startDate: Date } | undefined =
    undefined;

  addStep(step: StepData) {
    if (this.inProgressOperation) {
      this.committedPercent += this.inProgressOperation.step.percent;
    }
    this.inProgressOperation = { step, startDate: new Date() };
  }

  currentMessage() {
    return this.inProgressOperation?.step.message;
  }

  currentPercent() {
    let result = this.committedPercent;

    if (this.inProgressOperation) {
      const elapsed =
        Number(new Date()) - Number(this.inProgressOperation.startDate);
      const average = this.inProgressOperation.step.averageCompletionTimeInMs;
      const stepTotalPercent = this.inProgressOperation.step.percent;

      const happyPathThreshold = 0.8;

      const stepPercent =
        elapsed / average < happyPathThreshold
          ? // increases linearly from 0 to 0.8
            elapsed / average
          : happyPathThreshold +
            (1.0 - happyPathThreshold) *
              Math.min(
                // increase logarithmically, reaching 1.0 when extra elapsed time is 4 times
                // the average time
                Math.log10(
                  1 +
                    ((elapsed - average * happyPathThreshold) / (average * 4)) *
                      9,
                ),
                1,
              );

      result += stepTotalPercent * stepPercent;
    }

    return result;
  }

  delayReason(): DelayReason {
    if (!this.inProgressOperation) {
      return undefined;
    }

    const elapsed =
      Number(new Date()) - Number(this.inProgressOperation.startDate);
    const average = this.inProgressOperation.step.averageCompletionTimeInMs;

    return elapsed > 5000 && elapsed < average
      ? 'normal'
      : elapsed > 2000 && elapsed > average
        ? 'unexpected'
        : undefined;
  }
}
