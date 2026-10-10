'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { PointsMeterBar } from '@/components/builder/points-meter';
import {
  FindingsBadge,
  FindingsPanel,
} from '@/components/builder/validation-panel';
import { ArmyCardsSection } from '@/components/fantasy/army-cards-section';
import { fantasyAnchors } from '@/components/fantasy/fantasy-anchors';
import { usePublishFantasySnapshot } from '@/components/fantasy/fantasy-builder-state';
import { FormatSection } from '@/components/fantasy/format-section';
import { GeneralSection } from '@/components/fantasy/general-section';
import { HeroesSection, heroName } from '@/components/fantasy/heroes-section';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { UnitsSection } from '@/components/fantasy/units-section';
import {
  type FantasyNameLookup,
  useFantasyFindings,
} from '@/components/fantasy/use-fantasy-findings';
import type { FantasySavedArmy } from '@/lib/domain/army/saved-army';
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
import { fantasy } from '@/lib/domain/games/fantasy';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { formatPoints } from '@/lib/format';

export const newItemId = () => crypto.randomUUID().slice(0, 8);

const useBuilderNames = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
  names: TroopTypeNames,
): FantasyNameLookup => {
  const b = useTranslations('fantasyBuilder');
  return useMemo(
    () => ({
      card: (code) => fantasyCardName(code, catalogue.cards.get(code)),
      unit: (id) => {
        const unit = selection.units.find((candidate) => candidate.id === id);
        return unit ? unitName(unit, names) : id;
      },
      hero: (id) => {
        const index = selection.heroes.findIndex(
          (candidate) => candidate.id === id,
        );
        const hero = selection.heroes[index];
        return hero ? heroName(hero, index, b('hero')) : id;
      },
    }),
    [selection, catalogue, names, b],
  );
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
  const presenter = useFantasyFindings(
    useBuilderNames(selection, catalogue, names),
  );
  const snapshot = useMemo(
    () => ({ listName, rename, selection, saved, reference }),
    [listName, selection, saved, reference],
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
        }}
      />
      <HeroesSection
        priced={points.heroes}
        context={{ catalogue, selection, onEdit, newId: newItemId }}
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
