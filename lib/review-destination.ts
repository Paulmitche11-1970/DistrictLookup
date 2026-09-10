import { instances } from './instances';
import type { ReviewScope } from './review-token';
export function reviewDestination(scope: ReviewScope, value?: string | null) {
  const allowed =
    scope === 'rp'
      ? [
          '/',
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
