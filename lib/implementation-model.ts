import { z } from 'zod';
export const implementationStatuses = [
  'requested',
  'reviewing',
  'building',
  'ready',
  'live',
  'cancelled',
] as const;
export const billingStatuses = ['draft', 'issued', 'paid', 'void'] as const;
const text = (max: number) => z.string().trim().max(max);
export const implementationSchema = z
  .object({
    requestKey: z.uuid(),
    revision: z.number().int().positive(),
    offerVersion: text(80),
    name: text(150).min(2),
    title: text(150).min(2),
    email: z.email().max(250),
    phone: text(80),
    website: text(500).refine(
      (v) => !v || /^https?:\/\//i.test(v),
      'Use a complete http or https website address.',
    ),
    billingName: text(200).min(2),
    billingEmail: z.email().max(250),
    billingAddress: text(1000),
    layout: z.enum(['classic', 'concierge', 'explorer', 'directory']),
    delivery: z.enum(['embed', 'hosted', 'both', 'help']),
    frequency: z.enum(['monthly', 'annual']),
    notes: text(4000),
    authorized: z.literal(true),
    pricingAccepted: z.literal(true),
  })
  .strict();
export type ImplementationInput = z.infer<typeof implementationSchema>;
export const implementationUpdateSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(implementationStatuses),
    billingStatus: z.enum(billingStatuses),
    serviceStart: text(10).refine(
      (v) =>
        !v ||
        (/^20\d{2}-\d{2}-\d{2}$/.test(v) &&
          !Number.isNaN(Date.parse(v + 'T12:00:00Z')) &&
          new Date(v + 'T12:00:00Z').toISOString().startsWith(v)),
      'Enter a valid service start date.',
    ),
    owner: text(150),
    invoiceReference: text(200),
    note: text(2000),
  })
  .strict();
