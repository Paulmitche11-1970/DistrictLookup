import { ArrowUpRight } from 'lucide-react';
import type { Content } from '@/lib/model';
import type { DesignId } from '@/lib/designs';
import { Brand } from './lookup-shared';

export function LookupHeader({
  content,
  preview = false,
}: {
  content: Content;
  design: DesignId;
  embedded?: boolean;
  preview?: boolean;
}) {
  return (
    <>
      <header className="public-header">
        <Brand
          name={content.agency.shortName}
          sandbox={content.agency.sandbox}
        />
        <nav className="header-links" aria-label="Page navigation">
          {preview && (
            <span className="preview-label small muted">
              Unpublished preview
            </span>
          )}
          <a
            className="website-link row"
            href={
              content.agency.sandbox
                ? '/arpeeville/administration'
                : content.agency.website
            }
            target="_blank"
            rel="noreferrer"
          >
            {content.agency.sandbox ? 'Test administration' : 'City website'}{' '}
            <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      {content.agency.sandbox && (
        <div className="sandbox-banner">
          <strong>Arpeeville · Fictional test agency</strong>
          <span>
            Sample addresses, districts, offices and contact details are for
            demonstration.
          </span>
          <a href="/arpeeville">Test workspace</a>
        </div>
      )}
    </>
  );
}
