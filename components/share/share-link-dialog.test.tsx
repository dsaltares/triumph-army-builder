import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkDialog } from '@/components/share/share-link-dialog';
import { renderUi } from '@/test/ui';

const url = 'http://localhost:3013/s/AbCdEfGhIjKl';

const show = (props: Partial<Parameters<typeof ShareLinkDialog>[0]> = {}) =>
  renderUi(
    <ShareLinkDialog
      open
      pending={false}
      error={null}
      url={url}
      onOpenChange={() => {}}
      {...props}
    />,
  );

const dialog = () => within(screen.getByRole('dialog'));

const withoutClipboard = () => {
  const clipboard = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
  });
  return () =>
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboard,
      configurable: true,
    });
};

const selectionCopies = (answer: boolean) =>
  Object.defineProperty(document, 'execCommand', {
    value: vi.fn(() => answer),
    configurable: true,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShareLinkDialog', () => {
  it('shows the link to read, to select and to copy', async () => {
    const { user } = show();

    expect(dialog().getByLabelText('Link')).toHaveValue(url);

    await user.click(dialog().getByRole('button', { name: 'Copy' }));

    expect(await navigator.clipboard.readText()).toBe(url);
    expect(dialog().getByRole('button', { name: 'Copied' })).toBeVisible();
  });

  it('copies through the selection where there is no clipboard to write to', async () => {
    const { user } = show();
    const restore = withoutClipboard();
    selectionCopies(true);

    await user.click(dialog().getByRole('button', { name: 'Copy' }));

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(dialog().getByRole('button', { name: 'Copied' })).toBeVisible();
    restore();
  });

  it('says to select the link itself when nothing will copy it', async () => {
    const { user } = show();
    const restore = withoutClipboard();
    selectionCopies(false);

    await user.click(dialog().getByRole('button', { name: 'Copy' }));

    expect(dialog().getByRole('button', { name: 'Copy' })).toBeVisible();
    restore();
  });

  it('offers the link as a scannable code that opens it', async () => {
    show();

    const code = await dialog().findByRole('img', {
      name: `QR code for ${url}`,
    });

    expect(code).toBeVisible();
    expect(code.closest('a')).toHaveAttribute('href', url);
  });

  it('keeps the code dark on light so a scanner reads it in either theme', async () => {
    show();

    const code = await dialog().findByRole('img', {
      name: `QR code for ${url}`,
    });

    expect(code.querySelector('rect')).toHaveAttribute('fill', '#ffffff');
    expect(code.querySelector('path')).toHaveAttribute('fill', '#000000');
  });

  it('shows no code until there is a link to put in one', () => {
    show({ url: null, pending: true });

    expect(dialog().queryByRole('img')).not.toBeInTheDocument();
  });

  it('says it is working before the link arrives', () => {
    show({ url: null, pending: true });

    expect(dialog().getByText('Making a link…')).toBeVisible();
    expect(dialog().queryByLabelText('Link')).not.toBeInTheDocument();
  });

  it('says what went wrong instead of a link that was never made', () => {
    show({ url: null, error: 'Sign in to share more than 100 lists' });

    expect(
      dialog().getByText('Sign in to share more than 100 lists'),
    ).toBeVisible();
    expect(dialog().queryByLabelText('Link')).not.toBeInTheDocument();
  });
});
