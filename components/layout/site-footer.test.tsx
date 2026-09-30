import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from '@/components/layout/site-footer';
import { externalLinks } from '@/lib/navigation';
import { serveApi } from '@/test/api';
import { renderUi } from '@/test/ui';

const servedDataVersion = '2026-09-28.0123abcd';

const api = serveApi({ dataVersion: servedDataVersion });

const openFooter = () => renderUi(<SiteFooter />, { wrap: api.wrap });

const row = (name: string) => screen.getByRole('link', { name }).closest('p');

describe('SiteFooter', () => {
  it('keeps the source alongside the legal documents', () => {
    openFooter();

    const source = screen.getByRole('link', { name: 'Source on GitHub' });
    expect(source).toHaveAttribute('href', externalLinks.repository);
    expect(source).toHaveAttribute('target', '_blank');
    expect(row('Source on GitHub')).toBe(row('Privacy policy'));
    expect(row('Source on GitHub')).toBe(row('Cookie policy'));
  });

  it('names the data version the server serves', async () => {
    openFooter();

    expect(await screen.findByText(servedDataVersion)).toBeInTheDocument();
  });

  it('holds its placeholder for the version inside the paragraph without a div', () => {
    const { container } = openFooter();

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(container.querySelector('p div')).toBeNull();
  });

  it('credits the publisher and the data without a link to the source', () => {
    openFooter();

    expect(row('Triumph!')).not.toBe(row('Source on GitHub'));
    expect(screen.getByText(/unofficial fan project/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meshwesh' })).toHaveAttribute(
      'href',
      externalLinks.meshwesh,
    );
  });
});
