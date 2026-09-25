import { z } from 'zod';

export const sectionTypes = [
  'hero',
  'intro',
  'text',
  'split',
  'services',
  'profiles',
  'cards',
  'offer',
] as const;
export const sectionNames: Record<(typeof sectionTypes)[number], string> = {
  hero: 'Hero with image',
  intro: 'Page introduction',
  text: 'Text section',
  split: 'Image and text',
  services: 'Numbered services',
  profiles: 'Team profiles',
  cards: 'Cards / image gallery',
  offer: 'Offer / call to action',
};
export function safeWebsiteLink(value: string) {
  if (!value) return true;
  if (
    /^\/(?!\/)[a-zA-Z0-9/_#?=&.%-]*$/.test(value) ||
    /^#[a-z0-9-]+$/.test(value)
  )
    return true;
  try {
    const u = new URL(value);
    return (
      ['https:', 'mailto:', 'tel:'].includes(u.protocol) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
export function safeWebsiteImage(value: string) {
  return (
    !value ||
    /^\/api\/website\/media\/[a-f0-9]{32}$/.test(value) ||
    /^\/(?:rpdata\/team|design-previews)\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp)$/.test(
      value,
    ) ||
    value === '/rpdata-mark.svg'
  );
}
const short = z.string().max(250);
const link = z
  .string()
  .max(1500)
  .refine(
    safeWebsiteLink,
    'Use a relative path or an https, mailto, or tel link.',
  );
const image = z
  .string()
  .max(500)
  .refine(safeWebsiteImage, 'Choose an image from the media library.');
const itemSchema = z.object({
  id: short,
  title: short,
  subtitle: short,
  body: z.string().max(50000),
  image,
  alt: z.string().max(300),
  link,
  linkLabel: short,
});
const sectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  type: z.enum(sectionTypes),
  eyebrow: short,
  title: z.string().max(500),
  body: z.string().max(100000),
  image,
  alt: z.string().max(300),
  link,
  linkLabel: short,
  items: z.array(itemSchema).max(40),
});
const reserved = new Set([
  'admin',
  'api',
  'rpdata',
  'send',
  'review-access',
  'logs',
  'login',
  'robots',
  'sitemap',
  'favicon',
]);
export const pageSchema = z.object({
  kind: z.literal('page'),
  slug: z
    .string()
    .max(80)
    .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/)
    .refine((s) => !reserved.has(s), 'That page address is reserved.'),
  title: z.string().min(1).max(150),
  description: z.string().max(500),
  navLabel: z.string().min(1).max(45),
  showInNav: z.boolean(),
  order: z.number().int().min(0).max(1000),
  sections: z.array(sectionSchema).min(1).max(40),
});
export const settingsSchema = z.object({
  kind: z.literal('settings'),
  siteName: z.string().min(1).max(80),
  tagline: short,
  description: z.string().max(500),
  logo: image,
  contactEyebrow: short,
  contactTitle: z.string().max(500),
  contactBody: z.string().max(10000),
  contactEmail: z.email().max(250),
  contactButton: short,
  partnerLabel: short,
  partnerUrl: link,
});
export const websiteDocumentSchema = z.discriminatedUnion('kind', [
  pageSchema,
  settingsSchema,
]);
export type WebsitePage = z.infer<typeof pageSchema>;
export type WebsiteSettings = z.infer<typeof settingsSchema>;
export type WebsiteDocument = WebsitePage | WebsiteSettings;
export type WebsiteSection = WebsitePage['sections'][number];
export type WebsiteItem = WebsiteSection['items'][number];
export type WebsiteRecord = {
  id: string;
  draft: WebsiteDocument;
  published: WebsiteDocument | null;
  revision: number;
  publishedRevision: number | null;
  updatedAt: string;
  publishedAt: string | null;
};
export type WebsiteMedia = {
  id: string;
  url: string;
  name: string;
  alt: string;
  width: number;
  height: number;
};
export const emptyItem = (): WebsiteItem => ({
  id: '',
  title: '',
  subtitle: '',
  body: '',
  image: '',
  alt: '',
  link: '',
  linkLabel: '',
});
export const emptySection = (
  type: WebsiteSection['type'] = 'text',
): WebsiteSection => ({
  id: 'section-' + Math.random().toString(36).slice(2, 10),
  type,
  eyebrow: '',
  title: 'New section',
  body: '<p>Add your content here.</p>',
  image: '',
  alt: '',
  link: '',
  linkLabel: '',
  items: [],
});
