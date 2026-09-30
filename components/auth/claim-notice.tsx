'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useUndoClaim } from '@/components/army/use-saved-armies';
import { claimedFrom, expiredClaimCookie } from '@/lib/auth/claim';
import { useSession } from '@/lib/auth/client';
import { isSignedIn } from '@/lib/auth/session';

const noticeDuration = 12_000;

export function ClaimNotice() {
  const t = useTranslations('auth');
  const { mutate: undoClaim } = useUndoClaim();
  const { data } = useSession();
  const claimedBy = isSignedIn(data) ? data.user.id : null;

  useEffect(() => {
    const claimed = claimedBy ? claimedFrom(document.cookie) : [];
    if (claimed.length === 0) {
      return;
    }
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API it points at is in neither Safari nor Firefox
    document.cookie = expiredClaimCookie();

    toast.success(t('claimed', { count: claimed.length }), {
      description: t('claimedDescription'),
      duration: noticeDuration,
      action: {
        label: t('undo'),
        onClick: () =>
          undoClaim(
            { ids: claimed },
            {
              onSuccess: ({ removed }) =>
                toast.success(t('claimUndone', { count: removed })),
            },
          ),
      },
    });
  }, [undoClaim, claimedBy, t]);

  return null;
}
