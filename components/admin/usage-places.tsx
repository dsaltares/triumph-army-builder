'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CountTable } from '@/components/admin/count-table';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { Section } from '@/components/layout/section';
import { formatCountry } from '@/lib/format';

export type CountryCount = { country: string; events: number };

export type CityCount = {
  country: string;
  region: string | null;
  city: string;
  events: number;
};

export function UsagePlaces({
  countries,
  cities,
  widen,
}: {
  countries: readonly CountryCount[];
  cities: readonly CityCount[];
  widen: ReactNode;
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  return (
    <Section title={t('placesTitle')} description={t('placesDescription')}>
      {countries.length === 0 ? (
        <EmptyState title={t('noPlacesTitle')} actions={widen}>
          <EmptyStateText>{t('noPlacesText')}</EmptyStateText>
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CountTable
            title={t('countriesTitle')}
            labelColumns={[t('countryColumn')]}
            countColumn={t('eventsColumn')}
            rows={countries.map(({ country, events }) => ({
              key: country,
              labels: [formatCountry(country, locale)],
              count: events,
            }))}
          />
          {cities.length > 0 && (
            <CountTable
              title={t('citiesTitle')}
              labelColumns={[t('cityColumn')]}
              countColumn={t('eventsColumn')}
              rows={cities.map(({ country, region, city, events }) => ({
                key: [country, region, city].join('|'),
                labels: [
                  [city, region, formatCountry(country, locale)]
                    .filter(Boolean)
                    .join(', '),
                ],
                count: events,
              }))}
            />
          )}
        </div>
      )}
    </Section>
  );
}
