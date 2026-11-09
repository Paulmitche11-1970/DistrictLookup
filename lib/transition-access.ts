import { cookies } from 'next/headers';
import { currentAgencyId } from './agency-scope';
import {
  inClientPreview,
  outsideClientPreview,
  isClientPreview,
} from './client-preview-scope';
import { requireAdmin } from './security';
import { transitionKeyValid, transitionContent } from './board-transition';
import { visibleContent } from './store';
import { biographyImages } from './biography-html';

export const transitionCookie = () =>
  'dl_transition_' + currentAgencyId() + (isClientPreview() ? '_demo' : '');
export async function hasTransitionAccess() {
  if (transitionKeyValid((await cookies()).get(transitionCookie())?.value))
    return true;
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
// A read-only transition grant permits only media referenced by the incoming
// public-facing roster, never unrelated uploads, archived boards or live drafts.
export async function transitionPhotoAllowed(photo: string) {
  const jar = await cookies();
  const check = () => {
    if (!transitionKeyValid(jar.get(transitionCookie())?.value)) return false;
    const content = visibleContent(transitionContent());
    return (
      content.agency.showPhotos &&
      content.officials.some(
        (o) =>
          o.photo === photo ||
          (!o.vacant && biographyImages(o).includes(photo)),
      )
    );
  };
  return outsideClientPreview(check) || inClientPreview(check);
}
