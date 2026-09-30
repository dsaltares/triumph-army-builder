import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataVersionNotice } from '@/components/data-version-notice';
import { renderUi } from '@/test/ui';

const show = (savedVersion: string, currentVersion: string) =>
  renderUi(
    <DataVersionNotice
      savedVersion={savedVersion}
      currentVersion={currentVersion}
    />,
  );

describe('DataVersionNotice', () => {
  it('says nothing when the army is on the current data version', () => {
    const { container } = show('2026-09-17.9dfc73a9', '2026-09-17.9dfc73a9');

    expect(container).toBeEmptyDOMElement();
  });

  it('warns that an army was built against an older list version', () => {
    show('2026-09-17.9dfc73a9', '2026-11-02.1234abcd');

    expect(
      screen.getByText('Built against an older list version'),
    ).toBeInTheDocument();
    expect(screen.getByText(/2026-09-17\.9dfc73a9/)).toBeInTheDocument();
    expect(screen.getByText(/2026-11-02\.1234abcd/)).toBeInTheDocument();
  });

  it('warns that an army was built against a newer list version', () => {
    show('2026-11-02.1234abcd', '2026-09-17.9dfc73a9');

    expect(
      screen.getByText('Built against a newer list version'),
    ).toBeInTheDocument();
  });

  it('warns that an army carries a version it cannot place', () => {
    show('unversioned', '2026-09-17.9dfc73a9');

    expect(
      screen.getByText('Built against an unrecognised list version'),
    ).toBeInTheDocument();
  });
});
