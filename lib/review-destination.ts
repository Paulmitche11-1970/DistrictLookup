import { instances } from './instances';
import type { ReviewScope } from './review-token';
export function reviewDestination(scope: ReviewScope, value?: string | null) {
  // Safe internal boundary-library routes retain their destination after sign-in.
  if (
    scope === 'rp' &&
    value &&
    /^\/admin\/boundaries(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(value)
  )
    return value;
  const allowed =
    scope === 'rp'
      ? [
          '/',
          '/admin',
          '/logs',
          ...instances.flatMap((i) => [
            '/' + i.id,
            '/' + i.id + '/administration',
          ]),
          '/arpeeville/preview',
        ]
      : ['/martinez', '/martinez/administration'];
  return value && allowed.includes(value)
    ? value
    : scope === 'rp'
      ? '/'
      : '/martinez';
}
