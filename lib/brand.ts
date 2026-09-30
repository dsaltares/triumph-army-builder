export const siteName = 'Triumph! Army Builder';

export const siteShortName = 'Triumph!';

// The web app manifest is one static file for the whole site, outside the
// `[locale]` tree and with no cookie to read, so its description stays English.
// Every other use of this sentence comes from the `pages` namespace.
export const siteDescription =
  'Build, validate and share army lists for the Triumph! historical miniature wargame.';

export const appBackground = {
  light: { css: 'oklch(1 0 0)', hex: '#ffffff' },
  dark: { css: 'oklch(0.147 0.004 49.25)', hex: '#0c0a09' },
} as const;
