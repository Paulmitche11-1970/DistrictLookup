import { cookies } from 'next/headers';
import {
  clientPreviewCookie,
  validClientPreviewToken,
} from './client-preview-token';
import { inAgency } from './agency-scope';
import { inClientPreview } from './client-preview-scope';

export async function hasClientPreviewAccess(id: string) {
  return validClientPreviewToken(
    id,
    (await cookies()).get(clientPreviewCookie(id))?.value,
  );
}
export async function inViewerAgency<T>(
  id: string,
  work: () => T,
): Promise<Awaited<T>> {
  const preview = await hasClientPreviewAccess(id);
  return await inAgency(id, () => (preview ? inClientPreview(work) : work()));
}
