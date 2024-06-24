import { flatMap, indexOf, map, sumBy } from 'lodash';
import type { StepData } from './types';

export type Step<T> = {
  id: string;
  message: string;
  guessedTime: number;
  // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
  execute: () => Promise<T | void>;
};

export type Storage = {
  getCounters<K extends string>(keys: K[]): Promise<Record<K, number>>;
  incrementCounters<K extends string>(
    increments: Record<K, number>,
  ): Promise<void>;
};

export type Config<E> = {
  storage: Storage;
  serializeError: (error: unknown) => E;
};

async function getValueAndElapsedTime<T>(
  promise: Promise<T>,
): Promise<[T, number]> {
  const startTime = Date.now();
  const value = await promise;
  const elapsedTime = Date.now() - startTime;

  return [value, elapsedTime];
}

export function createResponseWithProgress<T, E>(
  config: Config<E>,
  steps: Step<T>[],
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      let progressiveId = 0;

      const send = (event: string, data: unknown) => {
        progressiveId += 1;

        const serializedData = JSON.stringify(data);

        controller.enqueue(
          encoder.encode(
            `id: ${progressiveId}\nevent: ${event}\ndata: ${serializedData}\n\n`,
          ),
        );
      };

      try {
        const pastData = await config.storage.getCounters(
          flatMap(map(steps, 'id'), (stepId) => [
            `${stepId}.totalTime`,
            `${stepId}.count`,
          ]),
        );

        const stepAverageTimes = steps.map(({ id: stepId, guessedTime }) => {
          const totalTime = pastData[`${stepId}.totalTime`];
          const count = pastData[`${stepId}.count`];

          return {
            id: stepId,
            averageTime: totalTime && count ? totalTime / count : guessedTime,
          };
        });

        const totalAverageTime = sumBy(stepAverageTimes, 'averageTime');

        const elapsedTimes: Array<{ id: string; time: number }> = [];

        for (const step of steps) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const averageTime = stepAverageTimes.find((i) => i.id === step.id)
            ?.averageTime!;

          const stepData: StepData = {
            percent: Number(
              ((averageTime / totalAverageTime) * 100).toFixed(2),
            ),
            averageCompletionTimeInMs: Math.round(averageTime),
            message: step.message,
          };

          send('step', stepData);

          const [result, elapsedTime] = await getValueAndElapsedTime(
            step.execute(),
          );

          elapsedTimes.push({ id: step.id, time: elapsedTime });

          if (indexOf(steps, step) === steps.length - 1) {
            send('return', result);
          }
        }

        const increments: Record<string, number> = {};

        for (const elapsedTime of elapsedTimes) {
          increments[`${elapsedTime.id}.totalTime`] = elapsedTime.time;
          increments[`${elapsedTime.id}.count`] = 1;
        }

        await config.storage.incrementCounters(increments);
      } catch (error) {
        send('requestError', config.serializeError(error));
        throw error;
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
