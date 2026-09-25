import { RenderPage, pageMetadata } from '../render';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return pageMetadata('what-we-do');
}
export default function Page() {
  return <RenderPage slug="what-we-do" />;
}
