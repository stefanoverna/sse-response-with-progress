export type Deferred<T> = {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  promise: Promise<T>;
};

export function isDeferred<T>(thing: unknown): thing is Deferred<T> {
  return Boolean(
    typeof thing === 'object' &&
      thing &&
      'promise' in thing &&
      'resolve' in thing &&
      'reject' in thing,
  );
}

export default function buildDeferred<T>(): Deferred<T> {
  const deferred = {} as Deferred<T>;

  const promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  deferred.promise = promise;

  return deferred;
}
