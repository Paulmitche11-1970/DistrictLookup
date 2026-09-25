import { RenderPage, pageMetadata } from '../render';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return pageMetadata('my-district');
}
export default function Page() {
  return <RenderPage slug="my-district" />;
}
