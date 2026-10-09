'use client';

import { useMemo, useState } from 'react';
import { AllyTroopOptionsSection } from '@/components/builder/ally-troop-options';
import { BattleCardsSection } from '@/components/builder/battle-cards';
import { usePublishBuilderSnapshot } from '@/components/builder/builder-state';
import { builderAnchors } from '@/components/builder/finding-anchor';
import { GatingControls } from '@/components/builder/gating-controls';
import {
  type GeneralChange,
  GeneralChip,
  GeneralToggleProvider,
} from '@/components/builder/general';
import { OptionalContingentsSection } from '@/components/builder/optional-contingents';
import { PointsMeterBar } from '@/components/builder/points-meter';
import { RequiredTroopsSection } from '@/components/builder/required-troops';
import type { StandsChange } from '@/components/builder/troop-option-card';
import { useBuilderGating } from '@/components/builder/use-builder-gating';
import {
  LegalityBadge,
  ValidationPanel,
} from '@/components/builder/validation-panel';
import type { ArmyList } from '@/lib/domain/army/army-list';
import { battleCardChoices } from '@/lib/domain/army/battle-card-selection';
import {
  gatingEffect,
  pointsMeter,
  startBuilding,
  withGating,
} from '@/lib/domain/army/builder';
import {
  allyTroopOptions,
  optionalContingents,
} from '@/lib/domain/army/contingent-selection';
import { generalChoice } from '@/lib/domain/army/general-selection';
import { armyPoints, type PointCosts } from '@/lib/domain/army/points';
import {
  defaultListName,
  type TriumphSavedArmy,
} from '@/lib/domain/army/saved-army';
import {
  type ArmySelection,
  withAllyTroopOption,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withoutContingentGroup,
  withStands,
  withTroopBattleCard,
} from '@/lib/domain/army/selection';
import { requiredTroops } from '@/lib/domain/army/troop-selection';
import { validationReport } from '@/lib/domain/army/validation-report';
import type {
  TroopTypeFactors,
  TroopTypeMovements,
  TroopTypeNames,
  TroopTypeProfiles,
} from '@/lib/domain/troop-types';

export type BuilderData = {
  dataVersion: string;
  armyList: ArmyList;
  costs: PointCosts;
  names: TroopTypeNames;
  factors: TroopTypeFactors;
  movement: TroopTypeMovements;
  profiles: TroopTypeProfiles;
};

export type ArmyBuilderViewProps = BuilderData & {
  saved?: TriumphSavedArmy | null;
  draft?: ArmySelection | null;
};

export function ArmyBuilderView({
  dataVersion,
  armyList,
  costs,
  names,
  factors,
  movement,
  profiles,
  saved = null,
  draft: unsaved = null,
}: ArmyBuilderViewProps) {
  const opened = saved?.selection ?? unsaved;
  const { gating, setYear, setVariant } = useBuilderGating(armyList, opened);
  const [draft, setDraft] = useState(
    () => opened ?? startBuilding(armyList, dataVersion),
  );
  const [listName, rename] = useState(
    () => saved?.name ?? defaultListName(armyList.name, new Date()),
  );
  const selection = useMemo(() => withGating(draft, gating), [draft, gating]);
  const meter = useMemo(
    () => pointsMeter(armyPoints(armyList, selection, costs)),
    [armyList, selection, costs],
  );
  const effect = useMemo(
    () => gatingEffect(armyList, gating),
    [armyList, gating],
  );
  const troops = useMemo(
    () => requiredTroops(armyList, selection, costs),
    [armyList, selection, costs],
  );
  const contingents = useMemo(
    () => optionalContingents(armyList, selection, costs),
    [armyList, selection, costs],
  );
  const allies = useMemo(
    () => allyTroopOptions(armyList, selection, costs),
    [armyList, selection, costs],
  );
  const cards = useMemo(
    () => battleCardChoices(armyList, selection, costs),
    [armyList, selection, costs],
  );
  const general = useMemo(
    () => generalChoice(armyList, selection),
    [armyList, selection],
  );
  const report = useMemo(
    () => validationReport(armyList, selection, costs, names),
    [armyList, selection, costs, names],
  );
  const anchors = useMemo(
    () => builderAnchors({ troops, contingents, allies, cards }),
    [troops, contingents, allies, cards],
  );
  const snapshot = useMemo(
    () => ({
      dataVersion,
      armyList,
      listName,
      rename,
      selection,
      replaceSelection: setDraft,
      costs,
      names,
      factors,
      movement,
      saved,
    }),
    [
      dataVersion,
      armyList,
      listName,
      selection,
      costs,
      names,
      factors,
      movement,
      saved,
    ],
  );

  usePublishBuilderSnapshot(snapshot);

  const changeStands: StandsChange = (option, troopType, stands) =>
    setDraft((current) => withStands(current, option, troopType, stands));
  const changeGeneral: GeneralChange = (chosen) =>
    setDraft((current) => withGeneral(current, chosen));

  return (
    <GeneralToggleProvider
      choice={general}
      troopTypeNames={names}
      onGeneralChange={changeGeneral}
    >
      <PointsMeterBar
        meter={meter}
        trailing={
          <>
            <GeneralChip
              choice={general}
              troopTypeNames={names}
              onGeneralChange={changeGeneral}
            />
            <LegalityBadge report={report} anchors={anchors} />
          </>
        }
      />
      <GatingControls
        armyList={armyList}
        gating={gating}
        effect={effect}
        troopTypeNames={names}
        onYearChange={setYear}
        onVariantChange={setVariant}
      />
      <RequiredTroopsSection
        troops={troops}
        troopTypeNames={names}
        troopTypeFactors={factors}
        troopTypeProfiles={profiles}
        onStandsChange={changeStands}
      />
      <OptionalContingentsSection
        contingents={contingents}
        troopTypeNames={names}
        troopTypeFactors={factors}
        troopTypeProfiles={profiles}
        onToggle={(group, taken) =>
          setDraft((current) =>
            taken
              ? withContingentGroup(current, group)
              : withoutContingentGroup(current, group),
          )
        }
        onStandsChange={changeStands}
      />
      <AllyTroopOptionsSection
        allies={allies}
        troopTypeNames={names}
        troopTypeFactors={factors}
        troopTypeProfiles={profiles}
        onChoose={(group) =>
          setDraft((current) => withAllyTroopOption(armyList, current, group))
        }
        onStandsChange={changeStands}
      />
      <BattleCardsSection
        choices={cards}
        troopTypeNames={names}
        onArmyCardChange={(code, copies) =>
          setDraft((current) => withArmyBattleCard(current, code, copies))
        }
        onTroopCardChange={(option, code, stands) =>
          setDraft((current) =>
            withTroopBattleCard(current, option, code, stands),
          )
        }
      />
      <ValidationPanel report={report} anchors={anchors} />
    </GeneralToggleProvider>
  );
}
