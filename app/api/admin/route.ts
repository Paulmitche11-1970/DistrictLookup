import { z } from 'zod';
import { database, state, changeDraft, publish } from '@/lib/store';
import {
  requireAdmin,
  checkOrigin,
  errorResponse,
  jsonBody,
  HttpError,
} from '@/lib/security';
import { officialSchema, agencySchema } from '@/lib/validation';
import { normalizeMap, locate } from '@/lib/geo';
import type { Address, Official } from '@/lib/model';
import { isSandbox, photoInScope, photoPrefix } from '@/lib/agency-scope';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
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
        `Updated ${official.district ? 'District ' + official.district : 'Mayor'}: ${official.name || 'vacant seat'}`,
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
        isSandbox() ? 'arpeeville' : 'martinez',
      );
      const addresses = database()
        .prepare('SELECT id,label,lon,lat FROM addresses')
        .all() as Address[];
      const matched = addresses.filter((a) => locate(map, a)).length;
      if (matched < addresses.length * 0.995)
        throw new HttpError(
          422,
          `The map leaves ${addresses.length - matched} existing city addresses unmatched or overlapping. Check the district field and city coverage.`,
        );
      content.map = map;
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
              title: 'Councilmember',
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
      const ids = content.map.features.map((f) => f.properties.district);
      if (
        ids.some(
          (id) =>
            content.officials.filter((o) => o.district === id).length !== 1,
        )
      )
        throw new HttpError(
          422,
          'Each district needs one official record or a marked vacancy.',
        );
      content.officials.forEach((o) => officialSchema.parse(o));
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
