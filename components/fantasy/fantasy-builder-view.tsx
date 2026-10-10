'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { PointsMeterBar } from '@/components/builder/points-meter';
import {
  type FindingPresenter,
  FindingsBadge,
  FindingsPanel,
} from '@/components/builder/validation-panel';
import { ArmyCardsSection } from '@/components/fantasy/army-cards-section';
import {
  fantasyAnchors,
  fantasyFindingAnchor,
} from '@/components/fantasy/fantasy-anchors';
import { usePublishFantasySnapshot } from '@/components/fantasy/fantasy-builder-state';
import { FormatSection } from '@/components/fantasy/format-section';
import { GeneralSection } from '@/components/fantasy/general-section';
import { HeroesSection, heroName } from '@/components/fantasy/heroes-section';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { UnitsSection } from '@/components/fantasy/units-section';
import type { FantasySavedArmy } from '@/lib/domain/army/saved-army';
import { fantasyTagWords } from '@/lib/domain/collection/fantasy-coverage';
import {
  startFantasyList,
  topographyPricedCards,
} from '@/lib/domain/fantasy/builder';
import {
  fantasyCardName,
  fantasyTroopTypeNames,
  unitName,
} from '@/lib/domain/fantasy/naming';
import { fantasyPoints } from '@/lib/domain/fantasy/points';
import {
  type FantasyCatalogue,
  type FantasyReference,
  fantasyCatalogue,
} from '@/lib/domain/fantasy/reference';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import type { FantasyFinding } from '@/lib/domain/fantasy/validation';
import { fantasy } from '@/lib/domain/games/fantasy';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { describeFantasyFinding } from '@/lib/fantasy-findings';
import { formatPoints, joinWithAnd } from '@/lib/format';

export const newItemId = () => crypto.randomUUID().slice(0, 8);

const useFantasyFindings = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
  names: TroopTypeNames,
): FindingPresenter<FantasyFinding> => {
  const t = useTranslations('fantasyFindings');
  const b = useTranslations('fantasyBuilder');
  const locale = useLocale();
  return useMemo(() => {
    const findingNames = {
      card: (code: Parameters<typeof fantasyCardName>[0]) =>
        fantasyCardName(code, catalogue.cards.get(code)),
      unit: (id: string) => {
        const unit = selection.units.find((candidate) => candidate.id === id);
        return unit ? unitName(unit, names) : id;
      },
      hero: (id: string) => {
        const index = selection.heroes.findIndex(
          (candidate) => candidate.id === id,
        );
        const hero = selection.heroes[index];
        return hero ? heroName(hero, index, b('hero')) : id;
      },
      army: b('theArmy'),
      join: (items: readonly string[]) => joinWithAnd(items, locale),
    };
    return {
      describe: (finding) => describeFantasyFinding(finding, t, findingNames),
      anchorOf: (finding) => fantasyFindingAnchor(finding.target),
    };
  }, [selection, catalogue, names, t, b, locale]);
};

export type FantasyBuilderViewProps = {
  dataVersion: string;
  reference: FantasyReference;
  saved?: FantasySavedArmy | null;
  draft?: FantasySelection | null;
};

export function FantasyBuilderView({
  dataVersion,
  reference,
  saved = null,
  draft = null,
}: FantasyBuilderViewProps) {
  const t = useTranslations('fantasyBuilder');
  const catalogue = useMemo(() => fantasyCatalogue(reference), [reference]);
  const names = useMemo(() => fantasyTroopTypeNames(reference), [reference]);
  const [selection, setSelection] = useState(
    () =>
      saved?.selection ??
      draft ??
      startFantasyList(reference.format, dataVersion),
  );
  const [listName, rename] = useState(
    () => saved?.name ?? fantasy.listTitle(reference, new Date()),
  );
  const points = useMemo(
    () => fantasyPoints(selection, catalogue),
    [selection, catalogue],
  );
  const meter = useMemo(
    () => fantasy.points(selection, reference),
    [selection, reference],
  );
  const report = useMemo(
    () => fantasy.validate(selection, reference),
    [selection, reference],
  );
  const anchors = useMemo(() => fantasyAnchors(selection), [selection]);
  const denseCards = useMemo(
    () => topographyPricedCards(catalogue).map(({ name }) => name),
    [catalogue],
  );
  const presenter = useFantasyFindings(selection, catalogue, names);
  const tagWords = useMemo(() => fantasyTagWords(selection), [selection]);
  const snapshot = useMemo(
    () => ({ listName, rename, selection, reference, saved }),
    [listName, selection, reference, saved],
  );

  usePublishFantasySnapshot(snapshot);

  const onEdit: SelectionEdit = useCallback(
    (edit) => setSelection((current) => edit(current)),
    [],
  );

  return (
    <>
      <PointsMeterBar
        meter={meter}
        subtotals={t('subtotals', {
          victory: formatPoints(points.victoryValue),
          army: formatPoints(points.linePoints),
        })}
        trailing={
          <FindingsBadge
            report={report}
            anchors={anchors}
            presenter={presenter}
          />
        }
      />
      <FormatSection
        format={selection.format}
        packFormat={catalogue.format}
        denseCards={denseCards}
        onEdit={onEdit}
      />
      <UnitsSection
        units={selection.units}
        priced={points.units}
        general={selection.general}
        context={{
          catalogue,
          names,
          format: selection.format,
          onEdit,
          newId: newItemId,
          tagWords,
        }}
      />
      <HeroesSection
        priced={points.heroes}
        context={{ catalogue, selection, onEdit, newId: newItemId, tagWords }}
      />
      <ArmyCardsSection
        selection={selection}
        lines={points.lines}
        catalogue={catalogue}
        onEdit={onEdit}
      />
      <GeneralSection selection={selection} names={names} onEdit={onEdit} />
      <FindingsPanel report={report} anchors={anchors} presenter={presenter} />
    </>
  );
}
