import { database } from '@/lib/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    database().prepare('SELECT 1').get();
    if (
      process.env.NODE_ENV === 'production' &&
      (!process.env.APP_SECRET ||
        process.env.APP_SECRET.length < 32 ||
        !process.env.APP_URL)
    )
      throw Error('Configuration incomplete');
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
