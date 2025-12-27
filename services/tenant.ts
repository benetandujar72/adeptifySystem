export type TenantResolution = {
  tenantSlug: string | null;
};

const TENANT_PREFIX = 't';

const isValidTenantSlug = (slug: string) => {
  // URL-safe, predictable, avoids weird Unicode / traversal-like strings.
  return /^[a-z0-9-]{3,50}$/.test(slug);
};

export const resolveTenantFromPathname = (pathname: string): TenantResolution => {
  const path = (pathname || '/').trim();
  const segments = path.split('/').filter(Boolean);

  // Expected: /t/{tenantSlug}/...
  if (segments.length >= 2 && segments[0] === TENANT_PREFIX) {
    const slug = segments[1];
    if (isValidTenantSlug(slug)) return { tenantSlug: slug };
    return { tenantSlug: null };
  }

  return { tenantSlug: null };
};

export const getTenantSlugFromWindow = (): string | null => {
  try {
    return resolveTenantFromPathname(window.location.pathname).tenantSlug;
  } catch {
    return null;
  }
};
