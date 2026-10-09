import { describe, expect, it } from 'vitest';
import {
  HydrationMarker,
  hydratedAttribute,
} from '@/components/layout/hydration-marker';
import { renderUi } from '@/test/ui';

describe('HydrationMarker', () => {
  it('marks the document once it has mounted, and unmarks it on unmount', () => {
    expect(document.documentElement.hasAttribute(hydratedAttribute)).toBe(
      false,
    );

    const { unmount } = renderUi(<HydrationMarker />);

    expect(document.documentElement.hasAttribute(hydratedAttribute)).toBe(true);

    unmount();

    expect(document.documentElement.hasAttribute(hydratedAttribute)).toBe(
      false,
    );
  });
});
