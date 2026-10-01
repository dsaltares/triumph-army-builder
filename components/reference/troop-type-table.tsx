import { useTranslations } from 'next-intl';
import { Section } from '@/components/layout/section';
import {
  StackedTable,
  StackedTableField,
  StackedTableGroup,
  StackedTableRow,
} from '@/components/stacked-table';
import {
  BaseSizesLabel,
  StandFiguresLabel,
  unknownValue,
} from '@/components/stand-basing';
import type { BundledTroopType } from '@/lib/data/bundle';
import type { TroopTypeCategory, TroopTypeOrder } from '@/lib/data/schema';
import { type TroopTypeGroup, troopTypeGroups } from '@/lib/domain/troop-types';

const columns =
  'grid gap-x-4 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(8rem,1.3fr)_4rem_4.5rem_minmax(7rem,1fr)_minmax(7rem,1fr)]';

const headings = [
  'troopType',
  'cost',
  'order',
  'closeCombat',
  'rangedCombat',
] as const;

const categoryLabels = {
  foot: 'foot',
  mounted: 'mounted',
} as const satisfies Record<TroopTypeCategory, string>;

const categoryDescriptions = {
  foot: 'footDescription',
  mounted: 'mountedDescription',
} as const satisfies Record<TroopTypeCategory, string>;

const orderLabels = {
  Close: 'closeOrder',
  Open: 'openOrder',
} as const satisfies Record<TroopTypeOrder, string>;

const orderGroupLabels = {
  Close: 'closeOrderTroopTypes',
  Open: 'openOrderTroopTypes',
} as const satisfies Record<TroopTypeOrder, string>;

function Factors({
  factors,
}: {
  factors: readonly { label: string; value: number }[];
}) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {factors.map(({ label, value }) => (
        <span key={label} className="inline-flex items-baseline gap-1">
          <span className="font-medium tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
      ))}
    </span>
  );
}

function StandProfile({ troopType }: { troopType: BundledTroopType }) {
  const t = useTranslations('builder');
  const w = useTranslations('sheet');
  const facts = [
    {
      key: 'move',
      label: w('move'),
      value:
        troopType.movement === undefined
          ? unknownValue
          : w('movementUnits', { distance: troopType.movement }),
    },
    {
      key: 'baseSizes',
      label: t('baseSizes'),
      value: <BaseSizesLabel basing={troopType.basing ?? null} />,
    },
    {
      key: 'standFigures',
      label: t('standFigures'),
      value: <StandFiguresLabel figures={troopType.basing?.figures ?? null} />,
    },
  ];
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
      {facts.map(({ key, label, value }) => (
        <div key={key} className="inline-flex items-baseline gap-1">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TroopTypeGroupSection({
  group,
}: {
  group: TroopTypeGroup<BundledTroopType>;
}) {
  const t = useTranslations('armies');
  return (
    <Section
      title={t(categoryLabels[group.category])}
      description={t(categoryDescriptions[group.category])}
    >
      <StackedTable columns={columns} headings={headings.map((key) => t(key))}>
        {group.orders.map(({ order, troopTypes }) => (
          <StackedTableGroup key={order} title={t(orderGroupLabels[order])}>
            {troopTypes.map((troopType) => (
              <StackedTableRow key={troopType.permanentCode}>
                <dl className={columns}>
                  <StackedTableField label={t('troopType')}>
                    <span className="font-medium">{troopType.displayName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {troopType.displayCode} · {troopType.permanentCode}
                    </span>
                  </StackedTableField>
                  <StackedTableField label={t('cost')}>
                    <span className="font-medium tabular-nums">
                      {troopType.cost}
                    </span>
                  </StackedTableField>
                  <StackedTableField label={t('order')}>
                    {t(orderLabels[troopType.order])}
                  </StackedTableField>
                  <StackedTableField label={t('closeCombat')}>
                    <Factors
                      factors={[
                        {
                          label: t('vsFoot'),
                          value: troopType.combatFactors.closeCombat.vsFoot,
                        },
                        {
                          label: t('vsMounted'),
                          value: troopType.combatFactors.closeCombat.vsMounted,
                        },
                      ]}
                    />
                  </StackedTableField>
                  <StackedTableField label={t('rangedCombat')}>
                    <Factors
                      factors={[
                        {
                          label: t('shooting'),
                          value: troopType.combatFactors.rangedCombat.shooting,
                        },
                        {
                          label: t('shotAt'),
                          value: troopType.combatFactors.rangedCombat.shotAt,
                        },
                      ]}
                    />
                  </StackedTableField>
                  <StackedTableField label={t('movementAndBasing')} wide>
                    <StandProfile troopType={troopType} />
                  </StackedTableField>
                  <StackedTableField label={t('description')} wide>
                    <p className="max-w-reading pt-1 text-xs text-pretty text-muted-foreground">
                      {troopType.description}
                    </p>
                  </StackedTableField>
                </dl>
              </StackedTableRow>
            ))}
          </StackedTableGroup>
        ))}
      </StackedTable>
    </Section>
  );
}

export function TroopTypeTable({
  troopTypes,
}: {
  troopTypes: readonly BundledTroopType[];
}) {
  return troopTypeGroups(troopTypes).map((group) => (
    <TroopTypeGroupSection key={group.category} group={group} />
  ));
}
