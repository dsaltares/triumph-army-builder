import {
  credentialProviderId,
  isSocialProviderId,
  providerName,
  type SocialProviderId,
} from './providers.ts';

export type LinkedAccount = {
  id: string;
  providerId: string;
};

export type ConnectedAccountAction =
  | { kind: 'connect' }
  | { kind: 'set-password' }
  | { kind: 'disconnect'; accountId: string };

export type ConnectedAccount = {
  providerId: string;
  name: string;
  connected: boolean;
  action: ConnectedAccountAction | undefined;
};

const actionFor = (
  providerId: string,
  accountId: string | undefined,
  removable: boolean,
): ConnectedAccountAction | undefined => {
  if (!accountId) {
    if (providerId === credentialProviderId) {
      return { kind: 'set-password' };
    }
    return isSocialProviderId(providerId) ? { kind: 'connect' } : undefined;
  }
  return removable && providerId !== credentialProviderId
    ? { kind: 'disconnect', accountId }
    : undefined;
};

export const connectedAccounts = (
  accounts: readonly LinkedAccount[],
  providers: readonly SocialProviderId[],
): readonly ConnectedAccount[] => {
  const linked = new Map(
    accounts.map(({ providerId, id }) => [providerId, id]),
  );
  const offered = [
    ...(accounts.length > 0 ? [credentialProviderId] : []),
    ...providers,
  ];
  const unoffered = [...linked.keys()].filter(
    (providerId) => !offered.includes(providerId),
  );
  const removable = accounts.length > 1;

  return [...offered, ...unoffered].map((providerId) => {
    const accountId = linked.get(providerId);
    return {
      providerId,
      name: providerName(providerId),
      connected: !!accountId,
      action: actionFor(providerId, accountId, removable),
    };
  });
};
