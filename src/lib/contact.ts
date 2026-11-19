/**
 * The one contact address, for Help & feedback, the landing page and every
 * email footer. The Supabase auth templates can't import it; a test keeps
 * them (and the docs) on this address. Shared with the Edge Functions: no
 * imports.
 */
export const CONTACT_EMAIL = "contact@shemme.codes";
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
