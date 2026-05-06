/**
 * The root HMS platform domain, set via VITE_ROOT_DOMAIN env var.
 * e.g. "medical.in"  →  hospitals live at  slug.medical.in
 * Leave blank in local dev — localhost is handled separately.
 */
const ROOT_DOMAIN = (import.meta.env.VITE_ROOT_DOMAIN || '').toLowerCase().trim();

/**
 * Returns the hospital slug when running on a known subdomain of ROOT_DOMAIN,
 * or falls back to the original heuristic when ROOT_DOMAIN is not set.
 * Returns null for the apex domain, IP addresses, and custom domains.
 */
export const getSubdomain = () => {
    const hostname = window.location.hostname;

    // Plain IP — no subdomain
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

    // Bare localhost — no subdomain
    if (hostname === 'localhost') return null;

    const parts = hostname.split('.');

    // Localhost subdomain testing: citycare.localhost
    if (hostname.endsWith('.localhost') && parts.length >= 2) {
        return parts[0] === 'www' ? null : parts[0];
    }

    // If ROOT_DOMAIN is configured and this hostname ends with it,
    // extract the leftmost segment as the hospital slug.
    if (ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
        const sub = hostname.slice(0, hostname.length - ROOT_DOMAIN.length - 1);
        // Strip any nested sub-parts — take only the immediate left segment
        const slug = sub.split('.').pop();
        return slug === 'www' ? null : slug;
    }

    // No ROOT_DOMAIN configured (local dev / direct deploy) — original heuristic
    if (!ROOT_DOMAIN && parts.length >= 3) {
        const sub = parts[0];
        if (sub === 'www') return parts.length > 3 ? parts[1] : null;
        return sub;
    }

    return null;
};

/**
 * Returns true when the browser is on a completely different domain
 * (not a subdomain of ROOT_DOMAIN and not localhost).
 * This means the hospital has pointed their own domain here via CNAME/A record.
 */
export const isCustomDomain = () => {
    const hostname = window.location.hostname;

    // Local environments — never a custom domain
    if (hostname === 'localhost') return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
    if (hostname.endsWith('.localhost')) return false;

    // If no root domain configured we can't distinguish — treat as subdomain flow
    if (!ROOT_DOMAIN) return false;

    // It's a custom domain if the hostname does NOT end with the root domain
    return !hostname.endsWith(ROOT_DOMAIN);
};
