export type AppOriginConfig = {
  APP_URL?: string;
  ADDITIONAL_APP_ORIGINS?: string;
};

function environmentConfig(): AppOriginConfig {
  return {
    APP_URL: process.env.APP_URL,
    ADDITIONAL_APP_ORIGINS: process.env.ADDITIONAL_APP_ORIGINS,
  };
}

function isLoopback(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

function exactOrigin(value: string, setting: string) {
  const message = `${setting} must contain exact HTTPS origins without paths, trailing slashes, credentials, queries, fragments or wildcards. HTTP is allowed only for local development.`;
  try {
    const url = new URL(value);
    if (
      value !== url.origin ||
      value.includes('*') ||
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && isLoopback(url.hostname)))
    )
      throw Error(message);
    return url.origin;
  } catch {
    throw Error(message);
  }
}

export function trustedAppOrigins(
  config: AppOriginConfig = environmentConfig(),
) {
  const appUrl = config.APP_URL?.trim();
  const aliases = config.ADDITIONAL_APP_ORIGINS?.trim();
  const canonical = appUrl ? exactOrigin(appUrl, 'APP_URL') : undefined;
  if (aliases && !canonical)
    throw Error('Set APP_URL before configuring ADDITIONAL_APP_ORIGINS.');
  const origins = new Set<string>(canonical ? [canonical] : []);
  if (aliases) {
    for (const alias of aliases.split(',')) {
      origins.add(exactOrigin(alias.trim(), 'ADDITIONAL_APP_ORIGINS'));
    }
  }
  return { canonical, origins };
}

// Return only the exact browser origin that passed the allowlist. Proxy host
// headers never add trusted origins or determine a review-login redirect.
export function acceptedRequestOrigin(
  request: Request,
  config: AppOriginConfig = environmentConfig(),
) {
  const { canonical, origins } = trustedAppOrigins(config);
  if (!canonical) {
    const local = new URL(request.url);
    if (!isLoopback(local.hostname))
      throw Error(
        'Set APP_URL before serving requests outside local development.',
      );
    origins.add(exactOrigin(local.origin, 'Local application origin'));
  }
  const origin = request.headers.get('origin');
  return origin && origins.has(origin) ? origin : null;
}
