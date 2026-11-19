/**
 * The Remember Me mark: a white heart in a rounded accent square. One source
 * for every place the logo is drawn (the Logo component, the OG image, the
 * email PNG from scripts/email-logo.ts). The PWA icons and favicon were drawn
 * from the same heart and are checked for centring in e2e/logo.spec.ts.
 *
 * Plain constants, no imports: scripts run this file with Node directly.
 */

/** The heart, drawn in a 24×24 box. */
export const HEART_PATH =
  "M12 21s-7.5-4.6-9.5-9.2C1.2 8.7 3.2 5 6.8 5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.6 0 5.6 3.7 4.3 6.8C19.5 16.4 12 21 12 21z";

/**
 * The heart's box runs from y 5 to 21 (centre 13), so a plain "0 0 24 24"
 * draws it 1/24 low. This viewBox centres it exactly (x is already 12).
 */
export const HEART_VIEWBOX = "0 1 24 24";

/** The light-theme accent (the email and OG colour; `--accent` in globals.css). */
export const LOGO_RED = "#d63b48";

/** Heart size as a share of the square, as in the app's Logo (16px in 32px). */
export const HEART_SCALE = 0.5;
