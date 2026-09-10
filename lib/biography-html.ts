import sanitizeHtml from 'sanitize-html';
import { photoInScope } from './agency-scope';
import { biographyEditorHtml } from './biography';
import type { Official } from './model';

// Sanitize on the server, both on save and on read, including legacy content.
export function sanitizeBiography(html: string, showImages = true) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'blockquote',
      'hr',
      'a',
      ...(showImages ? ['img'] : []),
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      ol: ['start'],
    },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/] } },
    allowedSchemes: ['https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => ({
        tagName: 'a',
        attribs: { ...attrs, target: '_blank', rel: 'noopener noreferrer' },
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'img' &&
      (!frame.attribs.src || !photoInScope(frame.attribs.src)),
    nestingLimit: 20,
  });
}
export function biographyHtml(
  official: Pick<Official, 'bio' | 'bioFormat'>,
  showImages = true,
) {
  return sanitizeBiography(biographyEditorHtml(official), showImages);
}
export function biographyImages(official: Pick<Official, 'bio' | 'bioFormat'>) {
  if (official.bioFormat !== 'html') return [];
  const images: string[] = [];
  sanitizeHtml(official.bio, {
    allowedTags: ['img'],
    allowedAttributes: { img: ['src'] },
    exclusiveFilter: (frame) => {
      if (frame.tag === 'img' && frame.attribs.src)
        images.push(frame.attribs.src);
      return false;
    },
  });
  return images;
}
