'use client';

import { useId, useState } from 'react';
import { ArrowUpRight, Globe, Mail, Phone, UserRound } from 'lucide-react';
import { phoneHref, type Content, type ManagementProfile } from '@/lib/model';

export function ManagementPortrait({
  profile,
  size = 72,
}: {
  profile: Pick<ManagementProfile, 'name' | 'photo'>;
  size?: number;
}) {
  const [failedPhoto, setFailedPhoto] = useState('');
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  const style = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 14,
    background: '#edf3f5',
  };
  return profile.photo && failedPhoto !== profile.photo ? (
    <img
      src={profile.photo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{ ...style, objectFit: 'cover' }}
      onError={() => setFailedPhoto(profile.photo)}
    />
  ) : (
    <div
      aria-hidden="true"
      style={{
        ...style,
        display: 'grid',
        placeItems: 'center',
        color: '#597583',
        fontSize: size / 3,
        fontWeight: 700,
      }}
    >
      {initials || <UserRound size={size / 3} />}
    </div>
  );
}

export function ManagementProfiles({ content }: { content: Content }) {
  const headingId = useId();
  const { agency } = content;
  const profiles = (content.management || []).filter(
    (profile) => profile.visible,
  );
  if (agency.showManagement === false || profiles.length === 0) return null;
  const isCity = !agency.kind || agency.kind === 'city';
  const contactStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    color: 'var(--primary)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    overflowWrap: 'anywhere' as const,
  };
  return (
    <section
      aria-labelledby={headingId}
      style={{
        width: '100%',
        maxWidth: 1100,
        minWidth: 0,
        margin: '32px auto',
        padding: '28px clamp(16px, 3vw, 28px)',
        borderTop: '1px solid var(--border)',
        boxSizing: 'border-box',
      }}
    >
      <h2 id={headingId} style={{ margin: '0 0 10px', fontSize: '1.4rem' }}>
        {isCity ? 'City Administration' : 'Agency Administration'}
      </h2>
      <p className="muted small" style={{ margin: '0 0 22px' }}>
        Connect with the people who manage {isCity ? 'city' : 'agency'}{' '}
        services.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 18,
        }}
      >
        {profiles.map((profile) => (
          <article
            key={profile.id}
            style={{
              padding: 22,
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 14,
              minWidth: 0,
              color: 'var(--foreground)',
            }}
          >
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {agency.showPhotos && <ManagementPortrait profile={profile} />}
              <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                <p
                  className="small muted"
                  style={{ margin: '0 0 5px', fontWeight: 600 }}
                >
                  {profile.title}
                </p>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {profile.name}
                </h3>
              </div>
            </div>
            {profile.bio && (
              <p
                className="small"
                style={{
                  margin: '18px 0 10px',
                  whiteSpace: 'pre-line',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.65,
                }}
              >
                {profile.bio}
              </p>
            )}
            <div style={{ marginTop: 12 }}>
              {agency.showEmail && profile.email && (
                <a href={`mailto:${profile.email}`} style={contactStyle}>
                  <Mail
                    size={17}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span>{profile.email}</span>
                </a>
              )}
              {agency.showPhone && profile.phone && (
                <a href={phoneHref(profile.phone)} style={contactStyle}>
                  <Phone
                    size={17}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span>
                    {profile.phone}
                    {profile.phoneLabel && (
                      <small style={{ display: 'block', color: '#607580' }}>
                        {profile.phoneLabel}
                      </small>
                    )}
                  </span>
                </a>
              )}
              {agency.showWebsite && /^https?:\/\//i.test(profile.website) && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  style={contactStyle}
                  aria-label={`Website for ${profile.name} (opens in a new tab)`}
                >
                  <Globe
                    size={17}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Website</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
