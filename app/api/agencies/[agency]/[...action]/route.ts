import { inAgency } from '@/lib/agency-scope';
import { instanceFor } from '@/lib/instances';
import * as admin from '../../../admin/route';
import * as addresses from '../../../addresses/route';
import * as lookup from '../../../lookup/route';
import * as photos from '../../../photos/route';
import * as photo from '../../../photos/[id]/route';
import * as auth from '../../../auth/[action]/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ agency: string; action: string[] }> };
export async function GET(request: Request, context: Context) {
  const { agency, action } = await context.params;
  const instance = instanceFor(agency);
  if (!instance || instance.sandbox)
    return new Response('Not found', { status: 404 });
  return inAgency(instance.id, async () => {
    if (action.length === 1) {
      if (action[0] === 'admin') return admin.GET();
      if (action[0] === 'addresses') return addresses.GET(request);
      if (action[0] === 'lookup') return lookup.GET(request);
    }
    if (action.length === 2) {
      if (action[0] === 'photos')
        return photo.GET(request, {
          params: Promise.resolve({ id: action[1] }),
        });
      if (action[0] === 'auth')
        return auth.GET(request, {
          params: Promise.resolve({ action: action[1] }),
        });
    }
    return new Response('Not found', { status: 404 });
  });
}
export async function POST(request: Request, context: Context) {
  const { agency, action } = await context.params;
  const instance = instanceFor(agency);
  if (!instance || instance.sandbox)
    return new Response('Not found', { status: 404 });
  return inAgency(instance.id, async () => {
    if (action.length === 1 && action[0] === 'admin')
      return admin.POST(request);
    if (action.length === 1 && action[0] === 'photos')
      return photos.POST(request);
    if (action.length === 2 && action[0] === 'auth')
      return auth.POST(request, {
        params: Promise.resolve({ action: action[1] }),
      });
    return new Response('Not found', { status: 404 });
  });
}
