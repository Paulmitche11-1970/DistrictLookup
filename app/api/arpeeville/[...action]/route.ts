import { inArpeeville } from '@/lib/agency-scope';
import * as admin from '../../admin/route';
import * as addresses from '../../addresses/route';
import * as lookup from '../../lookup/route';
import * as photos from '../../photos/route';
import * as photo from '../../photos/[id]/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ action: string[] }> };
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  return inArpeeville(async () => {
    if (action.length === 1) {
      if (action[0] === 'admin') return admin.GET();
      if (action[0] === 'addresses') return addresses.GET(request);
      if (action[0] === 'lookup') return lookup.GET(request);
    }
    if (action.length === 2 && action[0] === 'photos')
      return photo.GET(request, { params: Promise.resolve({ id: action[1] }) });
    return new Response('Not found', { status: 404 });
  });
}
export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  return inArpeeville(async () => {
    if (action.length === 1 && action[0] === 'admin')
      return admin.POST(request);
    if (action.length === 1 && action[0] === 'photos')
      return photos.POST(request);
    return new Response('Not found', { status: 404 });
  });
}
