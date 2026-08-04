/**
 * domainHelper.js — Shared domain normalization utilities
 *
 * Used by:
 *   - Hospital create/update routes (domain validation & uniqueness)
 *   - Public resolve-domain endpoint
 *   - Dynamic CORS origin checking
 */

/**
 * Normalize a raw domain string:
 *   - lowercase + trim
 *   - strip protocol (http:// / https://)
 *   - strip www.
 *   - strip port number
 *   - strip trailing path/slash
 *
 * Returns null if input is empty/invalid.
 *
 * Examples:
 *   "https://www.CRM.KrishnaIVF.com:443/login" → "crm.krishnaivf.com"
 *   "portal.apex.com"                           → "portal.apex.com"
 *   ""                                          → null
 */
function normalizeDomain(raw) {
    let d = (raw || '').trim().toLowerCase();
    d = d.replace(/^https?:\/\//, '');  // strip protocol
    d = d.replace(/^www\./, '');        // strip www.
    d = d.replace(/:\d+$/, '');         // strip port
    d = d.replace(/\/.*$/, '');         // strip trailing path
    return d || null;
}

/**
 * Validate that a domain string looks reasonable (has at least one dot,
 * no spaces, no special chars other than hyphens and dots).
 */
function isValidDomain(domain) {
    if (!domain) return false;
    // Must have at least one dot, only alphanumeric + hyphens + dots
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

module.exports = { normalizeDomain, isValidDomain };
