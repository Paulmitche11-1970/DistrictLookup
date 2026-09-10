import { z } from 'zod';
const text = (max = 200) => z.string().trim().max(max);
const email = z.union([z.literal(''), z.email().max(254)]);
const url = z.union([
  z.literal(''),
  z
    .url()
    .max(2000)
    .refine((v) => new URL(v).protocol === 'https:', 'Use an HTTPS website.'),
]);
export const officialSchema = z
  .object({
    id: text(30),
    district: z.union([text(20), z.null()]),
    name: text(120),
    title: text(100),
    additionalTitles: z.array(text(100).min(1)).max(5).optional(),
    selectionMethod: z.enum(['elected', 'appointed']).optional(),
    email,
    phone: text(40),
    phoneLabel: text(80),
    website: url,
    termEnd: z.union([
      z.literal(''),
      z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    ]),
    photo: z
      .string()
      .max(150)
      .refine(
        (v) =>
          !v ||
          /^\/portraits\/(1|2|3|4|mayor)\.jpg$/.test(v) ||
          /^\/portraits\/[a-z0-9-]+\/[a-zA-Z0-9_-]+\.(jpg|webp|png)$/.test(v) ||
          /^\/api\/(arpeeville\/|agencies\/[a-z0-9-]+\/)?photos\/[a-f0-9]{32}$/.test(
            v,
          ),
      ),
    bio: text(3000),
    staffName: text(120),
    staffEmail: email,
    staffPhone: text(40),
    vacant: z.boolean(),
  })
  .refine(
    (v) => v.vacant || v.name.length > 1,
    'Enter a name or mark the seat vacant.',
  );
export const agencySchema = z.object({
  name: text(120).min(2),
  shortName: text(40).min(2),
  state: text(40),
  heading: text(100).min(2),
  intro: text(350),
  website: url,
  contactEmail: email,
  contactPhone: text(40),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  showMayor: z.boolean(),
  showManagement: z.boolean().optional(),
  showPhotos: z.boolean(),
  showEmail: z.boolean(),
  showPhone: z.boolean(),
  showWebsite: z.boolean(),
  showTerm: z.boolean(),
  showStaff: z.boolean(),
  lookupDesign: z
    .enum(['classic', 'concierge', 'explorer', 'directory'])
    .optional(),
});
export const districtElectionSchema = z.object({
  status: z.enum(['district', 'transition']),
  firstElection: z
    .union([z.literal(''), z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)])
    .optional(),
});
export const managementSchema = z.object({
  id: text(30).min(1),
  name: text(120).min(2),
  title: text(100).min(2),
  email,
  phone: text(40),
  phoneLabel: text(80).optional(),
  website: url,
  photo: officialSchema.shape.photo,
  bio: text(3000),
  visible: z.boolean(),
});
export const credentialsSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
