import sanitizeHtml from 'sanitize-html';
import {
  safeWebsiteImage,
  safeWebsiteLink,
  websiteDocumentSchema,
  type WebsiteDocument,
} from './website-model';

export function sanitizeWebsiteHtml(html: string) {
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
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'hr',
      'a',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'title'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      ol: ['start'],
    },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right)$/] } },
    allowedSchemes: ['https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    nestingLimit: 20,
    transformTags: {
      a: (_tag, a) => ({
        tagName: 'a',
        attribs: { ...a, rel: 'noopener noreferrer' },
      }),
    },
    exclusiveFilter: (frame) =>
      (frame.tag === 'img' &&
        (!frame.attribs.src || !safeWebsiteImage(frame.attribs.src))) ||
      (frame.tag === 'a' && !safeWebsiteLink(frame.attribs.href || '')),
  });
}
export function cleanWebsiteDocument(value: unknown): WebsiteDocument {
  const doc = websiteDocumentSchema.parse(value);
  if (doc.kind === 'settings')
    doc.contactBody = sanitizeWebsiteHtml(doc.contactBody);
  else
    for (const section of doc.sections) {
      section.body = sanitizeWebsiteHtml(section.body);
      for (const item of section.items)
        item.body = sanitizeWebsiteHtml(item.body);
    }
  return doc;
}
