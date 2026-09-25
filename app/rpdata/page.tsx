import { RenderPage, pageMetadata } from './render';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return pageMetadata('');
}
export default function Page() {
  return <RenderPage slug="" />;
}
