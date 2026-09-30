import {
  IconBrandDiscord,
  IconBrandGoogle,
  IconKey,
} from '@tabler/icons-react';
import { credentialProviderId } from '@/lib/auth/providers';

const icons: Record<string, typeof IconKey> = {
  google: IconBrandGoogle,
  discord: IconBrandDiscord,
  [credentialProviderId]: IconKey,
};

export function ProviderIcon({ providerId }: { providerId: string }) {
  const Icon = icons[providerId] ?? IconKey;

  return <Icon className="size-4" />;
}
