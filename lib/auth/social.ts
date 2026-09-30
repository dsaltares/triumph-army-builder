import type { BetterAuthOptions } from 'better-auth';
import { type SocialProviderId, socialProviderIds } from './providers.ts';

export type SocialProviders = NonNullable<BetterAuthOptions['socialProviders']>;

type Environment = Record<string, string | undefined>;

const environmentKeys: Record<
  SocialProviderId,
  { clientId: string; clientSecret: string }
> = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
  },
  discord: {
    clientId: 'DISCORD_CLIENT_ID',
    clientSecret: 'DISCORD_CLIENT_SECRET',
  },
};

const credentialsFor = (id: SocialProviderId, environment: Environment) => {
  const clientId = environment[environmentKeys[id].clientId];
  const clientSecret = environment[environmentKeys[id].clientSecret];
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
};

export const socialProviders = (
  environment: Environment = process.env,
): SocialProviders =>
  Object.fromEntries(
    socialProviderIds.flatMap((id) => {
      const credentials = credentialsFor(id, environment);
      return credentials ? [[id, credentials] as const] : [];
    }),
  );

export const configuredSocialProviders = (
  environment: Environment = process.env,
): readonly SocialProviderId[] =>
  socialProviderIds.filter((id) => !!credentialsFor(id, environment));
