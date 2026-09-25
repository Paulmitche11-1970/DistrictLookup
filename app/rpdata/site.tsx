import { headers } from 'next/headers';
export async function siteBase() {
  const host = (await headers()).get('host')?.split(':')[0].toLowerCase();
  return host === 'rpdata.net' || host === 'www.rpdata.net' ? '' : '/rpdata';
}
