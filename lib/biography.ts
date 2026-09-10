import type { Official } from './model';
import type { DesignId } from './designs';

export const BIOGRAPHY_MAX_LENGTH = 50000;
export function biographyEditorHtml(
  official: Pick<Official, 'bio' | 'bioFormat'>,
) {
  if (official.bioFormat === 'html') return official.bio;
  return official.bio.trim()
    ? official.bio
        .split(/\n\s*\n/)
        .map(
          (paragraph) =>
            '<p>' +
            paragraph
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/\n/g, '<br>') +
            '</p>',
        )
        .join('')
    : '';
}
export function hasBiography(official: Pick<Official, 'bio' | 'bioFormat'>) {
  return official.bioFormat === 'html'
    ? /<img\s/i.test(official.bio) ||
        !!official.bio
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
          .trim()
    : !!official.bio.trim();
}
export function biographyPath(
  agencyId: string,
  officialId: string,
  preview = false,
  design: DesignId = 'classic',
) {
  const params = new URLSearchParams({ design });
  if (preview) params.set('preview', '1');
  return `/${agencyId}/officials/${encodeURIComponent(officialId)}?${params}`;
}
