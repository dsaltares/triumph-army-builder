import type { useTranslations } from 'next-intl';
import type { Finding, FindingParams } from './domain/army/validation.ts';

export type FindingTranslator = ReturnType<typeof useTranslations<'findings'>>;

type Rendered = { key: string; values?: Record<string, string | number> };

const render: {
  [Code in Finding['code']]: (params: FindingParams[Code]) => Rendered;
} = {
  overPointsCap: (values) => ({ key: 'overPointsCap', values }),
  underPointsCap: (values) => ({ key: 'underPointsCap', values }),
  yearOutsideArmyDateRange: (values) => ({
    key: 'yearOutsideArmyDateRange',
    values,
  }),
  subFactionNotChosen: (values) => ({ key: 'subFactionNotChosen', values }),
  unknownSubFaction: (values) => ({ key: 'unknownSubFaction', values }),
  unknownContingentGroup: (values) => ({
    key: 'unknownContingentGroup',
    values,
  }),
  contingentGroupUnavailable: (values) => ({
    key: 'contingentGroupUnavailable',
    values,
  }),
  multipleAllyTroopOptions: (values) => ({
    key: 'multipleAllyTroopOptions',
    values,
  }),
  troopOptionBelowMin: (values) => ({ key: 'troopOptionBelowMin', values }),
  troopOptionAboveMax: (values) => ({ key: 'troopOptionAboveMax', values }),
  troopOptionMixedTypes: ({ option, troopTypes }) => ({
    key: 'troopOptionMixedTypes',
    values: { option, troopTypes: troopTypes.join(' and ') },
  }),
  troopOptionUnavailable: (values) => ({
    key: 'troopOptionUnavailable',
    values,
  }),
  contingentNotTaken: (values) => ({ key: 'contingentNotTaken', values }),
  unknownTroopOption: (values) => ({ key: 'unknownTroopOption', values }),
  generalMissing: () => ({ key: 'generalMissing' }),
  generalStandMissing: (values) => ({ key: 'generalStandMissing', values }),
  generalFromAlliedContingent: (values) => ({
    key: 'generalFromAlliedContingent',
    values,
  }),
  generalTroopTypeNotAllowed: (values) => ({
    key: 'generalTroopTypeNotAllowed',
    values,
  }),
  battleCardUnavailable: (values) => ({ key: 'battleCardUnavailable', values }),
  battleCardAboveMax: ({ unit, card, subject, max, selected }) => ({
    key:
      unit === 'copies'
        ? 'battleCardAboveMaxCopies'
        : 'battleCardAboveMaxStands',
    values: { card, subject, max, selected },
  }),
  battleCardBelowMin: ({ unit, card, subject, min, selected }) => ({
    key:
      unit === 'copies'
        ? 'battleCardBelowMinCopies'
        : 'battleCardBelowMinStands',
    values: { card, subject, min, selected },
  }),
  battleCardNeedsPairsOfStands: (values) => ({
    key: 'battleCardNeedsPairsOfStands',
    values,
  }),
  battleCardStandsExceedOption: ({ perStand, card, option, applied, taken }) =>
    perStand
      ? {
          key: 'battleCardStandsExceedOption',
          values: { card, option, applied, taken },
        }
      : { key: 'battleCardBoughtForEmptyOption', values: { card, option } },
  battleCardPurchaseLimit: (values) => ({
    key: 'battleCardPurchaseLimit',
    values,
  }),
  battleCardForbidsTroopType: (values) => ({
    key: 'battleCardForbidsTroopType',
    values,
  }),
};

export const describeFinding = (finding: Finding, t: FindingTranslator) => {
  const { key, values } = (
    render[finding.code] as (params: Finding['params']) => Rendered
  )(finding.params);
  return t(key as Parameters<FindingTranslator>[0], values);
};
