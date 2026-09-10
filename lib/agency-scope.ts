import { AsyncLocalStorage } from 'node:async_hooks';
import { instanceFor, apiPath } from './instances';

// Only trusted, explicit server routes can select the sandbox. Never set this
// from a header, query string, editable agency field, or process-global flag.
const storage = new AsyncLocalStorage<string>();
export const currentAgencyId = () => storage.getStore() || 'martinez';
export const currentInstance = () => instanceFor(currentAgencyId())!;
export const isSandbox = () => currentInstance().sandbox === true;
export function inAgency<T>(id: string, work: () => T): T {
  const instance = instanceFor(id);
  if (!instance) throw Error('Unknown agency instance.');
  return storage.run(instance.id, work);
}
export function inArpeeville<T>(work: () => T): T {
  return inAgency('arpeeville', work);
}
export const photoPrefix = () => apiPath(currentAgencyId()) + '/photos/';
export function photoInScope(value: string) {
  if (!value) return true;
  const seed =
    currentAgencyId() === 'martinez'
      ? /^\/portraits\/((1|2|3|4|mayor)\.jpg|martinez\/[a-zA-Z0-9_-]+\.(jpg|webp|png))$/
      : new RegExp(
          '^/portraits/' +
            currentAgencyId() +
            '/[a-zA-Z0-9_-]+\\.(jpg|webp|png)$',
        );
  return (
    seed.test(value) ||
    (value.startsWith(photoPrefix()) &&
      /^[a-f0-9]{32}$/.test(value.slice(photoPrefix().length)))
  );
}
