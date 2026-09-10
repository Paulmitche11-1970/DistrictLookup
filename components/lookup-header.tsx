import { ArrowUpRight, LayoutGrid } from 'lucide-react';
import type { Content } from '@/lib/model';
import { designs, type DesignId } from '@/lib/designs';
import { Brand } from './lookup-shared';

export function LookupHeader({
  content,
  design,
  embedded = false,
  preview = false,
}: {
  content: Content;
  design: DesignId;
  embedded?: boolean;
  preview?: boolean;
}) {
  const current = designs.find((item) => item.id === design)!;
  return (
    <header className="public-header">
      <Brand name={content.agency.shortName} />
      <nav className="header-links" aria-label="Page navigation">
        {preview ? (
          <span className="preview-label small muted">Unpublished preview</span>
        ) : (
          !embedded && (
            <a
              className="design-return"
              href="/martinez"
              title="Compare all four designs"
            >
              <LayoutGrid size={15} />
              <span>All designs</span>
              <span className="design-current">
                {current.number} / {current.name}
              </span>
            </a>
          )
        )}
        <a
          className="website-link row"
          href={content.agency.website}
          target="_blank"
          rel="noreferrer"
        >
          City website <ArrowUpRight size={15} />
        </a>
        {!embedded && (
          <a className="agency-sign-in" href="/admin">
            Agency sign in
          </a>
        )}
      </nav>
    </header>
  );
}
