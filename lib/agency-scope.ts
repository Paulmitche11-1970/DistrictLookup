import { AsyncLocalStorage } from 'node:async_hooks';

// Only trusted, explicit server routes can select the sandbox. Never set this
// from a header, query string, editable agency field, or process-global flag.
const storage = new AsyncLocalStorage<'arpeeville'>();
export const isSandbox = () => storage.getStore() === 'arpeeville';
export function inArpeeville<T>(work: () => T): T {
  return storage.run('arpeeville', work);
}
export const photoPrefix = () =>
  isSandbox() ? '/api/arpeeville/photos/' : '/api/photos/';
export function photoInScope(value: string) {
  if (!value) return true;
  const seed = isSandbox()
    ? /^\/portraits\/arpeeville\/(liz|gabriella|kimi|paul|chris|jacob)\.jpg$/
    : /^\/portraits\/(1|2|3|4|mayor)\.jpg$/;
  return (
    seed.test(value) ||
    (value.startsWith(photoPrefix()) &&
      /^[a-f0-9]{32}$/.test(value.slice(photoPrefix().length)))
  );
}
