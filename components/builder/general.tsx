'use client';

import { useLocale, useTranslations } from 'next-intl';

import {
  findingAnchor,
  findingAnchorClass,
} from '@/components/builder/finding-anchor';
import { Section } from '@/components/layout/section';
import { Notice } from '@/components/notice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Contingent } from '@/lib/domain/army/army-list';
import type {
  GeneralCandidate,
  GeneralChoice,
  GeneralExclusion,
} from '@/lib/domain/army/general-selection';
import type { StandRef } from '@/lib/domain/army/selection';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { formatStands, joinWithOr } from '@/lib/format';

export type GeneralChange = (general: StandRef | null) => void;

type BuilderWords = ReturnType<typeof useTranslations<'builder'>>;

type ExclusionNotice = (
  candidate: GeneralCandidate,
  name: string,
  allowed: string,
  t: BuilderWords,
) => string;

const exclusionNotices: Readonly<Record<GeneralExclusion, ExclusionNotice>> = {
  alliedContingent: ({ contingent }, _name, _allowed, t) =>
    t('generalAllied', { contingent: contingent.name }),
  troopType: (_candidate, name, allowed, t) =>
    t('generalNotAllowed', { name, allowed }),
};

const contingentLabel = ({ kind, name }: Contingent, t: BuilderWords) =>
  kind === 'main' ? t('requiredTroops') : name;

const sourceOf = (
  { option, contingent }: GeneralCandidate,
  t: BuilderWords,
) => {
  if (!option.description) {
    return contingentLabel(contingent, t);
  }
  return contingent.kind === 'main'
    ? option.description
    : t('sourceInContingent', {
        option: option.description,
        contingent: contingent.name,
      });
};

function CandidateRow({
  candidate,
  name,
  onChoose,
}: {
  candidate: GeneralCandidate;
  name: string;
  onChoose: () => void;
}) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const { chosen, stands, excludedBy } = candidate;
  return (
    <li className="flex items-center gap-3">
      <Button
        variant={chosen ? 'default' : 'outline'}
        size="touch"
        aria-label={t('candidateLabel', {
          name,
          source: sourceOf(candidate, t),
        })}
        aria-pressed={chosen}
        onClick={onChoose}
      >
        {name}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{sourceOf(candidate, t)}</span>
          {chosen && (
            <Badge variant={excludedBy ? 'destructive' : 'secondary'}>
              {t('general')}
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatStands(stands, locale)}
        </p>
      </div>
    </li>
  );
}

export function GeneralSection({
  choice,
  troopTypeNames,
  onGeneralChange,
}: {
  choice: GeneralChoice;
  troopTypeNames: TroopTypeNames;
  onGeneralChange: GeneralChange;
}) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const { troopTypes, candidates, chosen, eligible, stands } = choice;
  const allowed = joinWithOr(
    troopTypes.map((troopType) => troopTypeNames[troopType]),
    locale,
  );

  return (
    <Section
      id={findingAnchor({ kind: 'general' })}
      className={findingAnchorClass}
      title={t('general')}
      description={t('generalDescription', { allowed })}
    >
      {candidates.length === 0 ? (
        <p className="max-w-reading text-sm text-pretty text-muted-foreground">
          {stands === 0
            ? t('generalNoStands', {
                allowed,
                section: t('requiredTroops'),
              })
            : t('generalNoneEligible', { allowed })}
        </p>
      ) : (
        <>
          <Card size="sm">
            <CardContent>
              <ul className="flex flex-col gap-3">
                {candidates.map((candidate) => (
                  <CandidateRow
                    key={`${candidate.option.id}/${candidate.troopType}`}
                    candidate={candidate}
                    name={troopTypeNames[candidate.troopType]}
                    onChoose={() =>
                      onGeneralChange(
                        candidate.chosen
                          ? null
                          : {
                              option: candidate.option.id,
                              troopType: candidate.troopType,
                            },
                      )
                    }
                  />
                ))}
              </ul>
            </CardContent>
          </Card>

          {chosen?.excludedBy && (
            <Notice>
              {exclusionNotices[chosen.excludedBy](
                chosen,
                troopTypeNames[chosen.troopType],
                allowed,
                t,
              )}
            </Notice>
          )}

          <p className="text-xs text-muted-foreground tabular-nums">
            {t('generalEligible', { eligible, stands })}
            {chosen
              ? t('generalChosen', {
                  troopType: troopTypeNames[chosen.troopType],
                  source: sourceOf(chosen, t),
                })
              : t('generalNoneChosen')}
          </p>
        </>
      )}
    </Section>
  );
}
