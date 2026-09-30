export const socialProviderIds = ['google', 'discord'] as const;

export type SocialProviderId = (typeof socialProviderIds)[number];

export const credentialProviderId = 'credential';

export const socialProviderNames: Record<SocialProviderId, string> = {
  google: 'Google',
  discord: 'Discord',
};

const names: Record<string, string> = {
  ...socialProviderNames,
  [credentialProviderId]: 'Email and password',
};

export const isSocialProviderId = (
  providerId: string,
): providerId is SocialProviderId =>
  (socialProviderIds as readonly string[]).includes(providerId);

export const providerName = (providerId: string) =>
  names[providerId] ?? providerId;
