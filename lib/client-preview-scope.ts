import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage<boolean>();
// Selected only by authenticated server routes. Never by an editable field.
export const isClientPreview = () => storage.getStore() === true;
export const inClientPreview = <T>(work: () => T): T => storage.run(true, work);
export const outsideClientPreview = <T>(work: () => T): T =>
  storage.run(false, work);
