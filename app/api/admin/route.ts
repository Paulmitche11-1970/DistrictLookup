import { z } from 'zod';
import { database, state, changeDraft, publish } from '@/lib/store';
import {
  requireAdmin,
  checkOrigin,
  errorResponse,
  jsonBody,
  HttpError,
} from '@/lib/security';
import {
  officialSchema,
  agencySchema,
  managementSchema,
  districtElectionSchema,
} from '@/lib/validation';
import { validateRepresentation } from '@/lib/representation';
import { normalizeMap, locate } from '@/lib/geo';
import type { Address, Official } from '@/lib/model';
import {
  isSandbox,
  currentAgencyId,
  currentInstance,
  photoInScope,
  photoPrefix,
} from '@/lib/agency-scope';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function checkRepresentation(
  content: Parameters<typeof validateRepresentation>[0],
) {
  try {
    validateRepresentation(content);
  } catch (error) {
    throw new HttpError(422, (error as Error).message);
  }
}
function checkPhoto(photo: string) {
  if (!photoInScope(photo))
    throw new HttpError(400, 'Use a photo uploaded for this agency.');
  if (
    photo.startsWith(photoPrefix()) &&
    !database()
      .prepare('SELECT id FROM photos WHERE id=?')
      .get(photo.split('/').at(-1)!)
  )
    throw new HttpError(400, 'Please upload that photo again.');
}
export async function GET() {
  try {
    const s = await requireAdmin();
    const current = state();
    return Response.json(
      {
        content: current.draft,
        revision: current.revision,
        publishedRevision: current.publishedRevision,
        publishedAt: current.publishedAt,
        hasChanges:
          JSON.stringify(current.draft) !== JSON.stringify(current.published),
        admin: { name: s.admin.name, email: s.admin.email },
        addressCount: (
          database().prepare('SELECT COUNT(*) AS n FROM addresses').get() as {
            n: number;
          }
        ).n,
        activity: database()
          .prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 60')
          .all(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const s = await requireAdmin();
    const body = await jsonBody(request, 12_000_000);
    const revision = z.number().int().min(1).parse(body.revision);
    const current = state();
    if (revision !== current.revision)
      throw new HttpError(
        409,
        'Another edit was saved. Reload before saving your changes.',
      );
    const content = current.draft;
    if (body.action === 'official') {
      const official = officialSchema.parse(body.official);
      if (!photoInScope(official.photo))
        throw new HttpError(400, 'Use a photo uploaded for this agency.');
      const index = content.officials.findIndex((o) => o.id === official.id);
      if (index < 0 || official.district !== content.officials[index].district)
        throw new HttpError(
          400,
          'The district assignment cannot be changed from this form.',
        );
      if (
        official.photo.startsWith(photoPrefix()) &&
        !database()
          .prepare('SELECT id FROM photos WHERE id=?')
          .get(official.photo.split('/').at(-1)!)
      )
        throw new HttpError(400, 'Please upload that photo again.');
      content.officials[index] = official;
      changeDraft(
        revision,
        content,
        s.admin.email,
        `Updated ${official.district ? 'District ' + official.district : 'At-large official'}: ${official.name || 'vacant seat'}`,
      );
    } else if (body.action === 'official-add') {
      const official = officialSchema.parse(body.official);
      if (official.district !== null)
        throw new HttpError(
          400,
          'Add the profile at large, then set its district in Representation.',
        );
      if (content.officials.some((o) => o.id === official.id))
        throw new HttpError(409, 'That official already exists.');
      if (content.officials.length >= 100)
        throw new HttpError(400, 'This agency has reached the profile limit.');
      checkPhoto(official.photo);
      content.officials.push(official);
      changeDraft(
        revision,
        content,
        s.admin.email,
        'Added at-large official: ' + official.name,
      );
    } else if (body.action === 'official-remove') {
      const id = z.string().min(1).max(30).parse(body.id);
      const official = content.officials.find((o) => o.id === id);
      if (!official || official.district !== null)
        throw new HttpError(
          400,
          'District seats must be kept and marked vacant. Only at-large profiles can be removed.',
        );
      content.officials = content.officials.filter((o) => o.id !== id);
      checkRepresentation(content);
      changeDraft(
        revision,
        content,
        s.admin.email,
        'Removed at-large profile: ' + official.name,
      );
    } else if (body.action === 'representation') {
      const assignments = z
        .array(
          z.object({
            id: z.string().min(1).max(30),
            district: z.union([z.string().min(1).max(20), z.null()]),
            selectionMethod: z.enum(['elected', 'appointed']).optional(),
          }),
        )
        .max(100)
        .parse(body.assignments);
      if (
        assignments.length !== content.officials.length ||
        new Set(assignments.map((o) => o.id)).size !== assignments.length ||
        assignments.some((o) => !content.officials.some((p) => p.id === o.id))
      )
        throw new HttpError(
          400,
          'Include every current official exactly once. Reload if the roster changed.',
        );
      content.officials = content.officials.map((o) => {
        const assignment = assignments.find((p) => p.id === o.id)!;
        return {
          ...o,
          ...assignment,
          selectionMethod: assignment.selectionMethod,
        };
      });
      content.districtElections = z
        .record(z.string().min(1).max(20), districtElectionSchema)
        .parse(body.districtElections);
      checkRepresentation(content);
      changeDraft(
        revision,
        content,
        s.admin.email,
        'Updated representation and district election status',
      );
    } else if (body.action === 'management') {
      const management = z
        .array(managementSchema)
        .max(20)
        .parse(body.management);
      if (new Set(management.map((p) => p.id)).size !== management.length)
        throw new HttpError(
          400,
          'Each management profile needs a unique identifier.',
        );
      management.forEach((p) => checkPhoto(p.photo));
      content.management = management;
      changeDraft(
        revision,
        content,
        s.admin.email,
        'Updated appointed management profiles',
      );
    } else if (body.action === 'agency') {
      content.agency = agencySchema.parse(body.agency);
      if (isSandbox()) content.agency.sandbox = true;
      changeDraft(
        revision,
        content,
        s.admin.email,
        'Updated display options and agency information',
      );
    } else if (body.action === 'design') {
      content.agency.lookupDesign = z
        .enum(['classic', 'concierge', 'explorer', 'directory'])
        .parse(body.design);
      changeDraft(
        revision,
        content,
        s.admin.email,
        'Changed lookup design to ' + content.agency.lookupDesign,
      );
    } else if (body.action === 'map') {
      const { map, skipped } = normalizeMap(
        body.map,
        String(body.field || 'district'),
        currentAgencyId(),
      );
      const addresses = database()
        .prepare('SELECT id,label,lon,lat FROM addresses')
        .all() as Address[];
      const matched = addresses.filter((a) => locate(map, a)).length;
      if (matched < addresses.length * 0.995)
        throw new HttpError(
          422,
          `The map leaves ${addresses.length - matched} existing agency addresses unmatched or overlapping. Check the district field and agency coverage.`,
        );
      content.map = map;
      content.districtElections = Object.fromEntries(
        Object.entries(content.districtElections || {}).filter(([id]) =>
          map.features.some((f) => f.properties.district === id),
        ),
      );
      content.mapName = z.string().trim().min(1).max(120).parse(body.mapName);
      content.mapEffectiveDate = z
        .string()
        .regex(/^20\d{2}-\d{2}-\d{2}$/)
        .parse(body.effectiveDate);
      const prior = new Map(
        content.officials.filter((o) => o.district).map((o) => [o.district, o]),
      );
      content.officials = [
        ...map.features.map(
          (f) =>
            prior.get(f.properties.district) ||
            ({
              id: 'district-' + f.properties.district,
              district: f.properties.district,
              name: '',
              title:
                currentInstance().kind === 'county'
                  ? 'Supervisor'
                  : 'Councilmember',
              email: '',
              phone: '',
              phoneLabel: '',
              website: '',
              termEnd: '',
              photo: '',
              bio: '',
              staffName: '',
              staffEmail: '',
              staffPhone: '',
              vacant: true,
            } as Official),
        ),
        ...content.officials.filter((o) => !o.district),
      ];
      changeDraft(
        revision,
        content,
        s.admin.email,
        `Uploaded ${content.mapName}; ${map.features.length} districts; ${skipped} unlabeled features excluded`,
      );
    } else if (body.action === 'publish') {
      checkRepresentation(content);
      content.officials.forEach((o) => officialSchema.parse(o));
      (content.management || []).forEach((p) => {
        managementSchema.parse(p);
        checkPhoto(p.photo);
      });
      if (content.officials.some((o) => !photoInScope(o.photo)))
        throw new HttpError(422, 'A photo belongs to another agency.');
      publish(revision, s.admin.email);
    } else if (body.action === 'discard') {
      changeDraft(
        revision,
        current.published,
        s.admin.email,
        'Discarded unpublished changes',
      );
    } else throw new HttpError(400, 'Unknown action.');
    return Response.json({ ok: true });
  } catch (e) {
    if (
      e instanceof Error &&
      !('status' in e) &&
      e.name !== 'ZodError' &&
      /district|polygon|map|vertices|Coordinates|Choose|Reload|draft changed/i.test(
        e.message,
      )
    )
      return Response.json({ error: e.message }, { status: 422 });
    return errorResponse(e);
  }
}
