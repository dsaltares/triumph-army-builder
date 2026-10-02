'use client';

import { IconCrown, IconCrownFilled } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { findingAnchor } from '@/components/builder/finding-anchor';
import { Notice } from '@/components/notice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { TroopTypeCode } from '@/lib/data/schema';
import type { Contingent, TroopOption } from '@/lib/domain/army/army-list';
import type {
  GeneralCandidate,
  GeneralChoice,
  GeneralExclusion,
} from '@/lib/domain/army/general-selection';
import type { StandRef } from '@/lib/domain/army/selection';
import type { TroopTypeNames } from '@/lib/domain/troop-types';
import { formatStands, joinWithOr } from '@/lib/format';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';

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

const generalAnchor = findingAnchor({ kind: 'general' });

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

const allowedTroopTypes = (
  { troopTypes }: GeneralChoice,
  troopTypeNames: TroopTypeNames,
  locale: Locale,
) =>
  joinWithOr(
    troopTypes.map((troopType) => troopTypeNames[troopType]),
    locale,
  );

const standRefOf = ({ option, troopType }: GeneralCandidate): StandRef => ({
  option: option.id,
  troopType,
});

const toggled = (candidate: GeneralCandidate) =>
  candidate.chosen ? null : standRefOf(candidate);

const isCandidateFor =
  (option: TroopOption, troopType: TroopTypeCode) =>
  (candidate: GeneralCandidate) =>
    candidate.option.id === option.id && candidate.troopType === troopType;

type GeneralToggle = {
  choice: GeneralChoice;
  troopTypeNames: TroopTypeNames;
  onGeneralChange: GeneralChange;
};

const GeneralToggleContext = createContext<GeneralToggle | null>(null);

export function GeneralToggleProvider({
  children,
  ...toggle
}: GeneralToggle & { children: ReactNode }) {
  return <GeneralToggleContext value={toggle}>{children}</GeneralToggleContext>;
}

const useStandCandidate = (option: TroopOption, troopType: TroopTypeCode) => {
  const toggle = useContext(GeneralToggleContext);
  const candidate = toggle?.choice.candidates.find(
    isCandidateFor(option, troopType),
  );
  return toggle && candidate ? { toggle, candidate } : null;
};

const crownColours = (candidate: GeneralCandidate) => {
  if (!candidate.chosen) {
    return 'text-muted-foreground hover:text-foreground';
  }
  return candidate.excludedBy ? 'text-destructive' : 'text-primary';
};

export function GeneralStandToggle({
  option,
  troopType,
  name,
}: {
  option: TroopOption;
  troopType: TroopTypeCode;
  name: string;
}) {
  const t = useTranslations('builder');
  const stand = useStandCandidate(option, troopType);
  if (!stand) {
    return null;
  }
  const { toggle, candidate } = stand;
  const Crown = candidate.chosen ? IconCrownFilled : IconCrown;
  const label = t('generalToggle', { name });
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={candidate.chosen}
      onClick={() => toggle.onGeneralChange(toggled(candidate))}
      className={cn(
        'relative inline-flex shrink-0 rounded-sm outline-none after:absolute after:-inset-3 focus-visible:ring-2 focus-visible:ring-ring',
        crownColours(candidate),
      )}
    >
      <Crown className="size-5" />
    </button>
  );
}

export function GeneralStandBadge({
  option,
  troopType,
}: {
  option: TroopOption;
  troopType: TroopTypeCode;
}) {
  const t = useTranslations('builder');
  const stand = useStandCandidate(option, troopType);
  if (!stand?.candidate.chosen) {
    return null;
  }
  return (
    <Badge variant={stand.candidate.excludedBy ? 'destructive' : 'secondary'}>
      {t('general')}
    </Badge>
  );
}

export function GeneralStandNotice({ option }: { option: TroopOption }) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const toggle = useContext(GeneralToggleContext);
  const chosen = toggle?.choice.chosen;
  if (!toggle || !chosen?.excludedBy || chosen.option.id !== option.id) {
    return null;
  }
  return (
    <Notice>
      {exclusionNotices[chosen.excludedBy](
        chosen,
        toggle.troopTypeNames[chosen.troopType],
        allowedTroopTypes(toggle.choice, toggle.troopTypeNames, locale),
        t,
      )}
    </Notice>
  );
}

function CandidateRow({
  candidate,
  name,
  onChoose,
  onFollow,
}: {
  candidate: GeneralCandidate;
  name: string;
  onChoose: () => void;
  onFollow: () => void;
}) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const { chosen, stands, excludedBy, option } = candidate;
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
          <a
            href={`#${findingAnchor({ kind: 'troopOption', option: option.id })}`}
            onClick={onFollow}
            className="text-sm font-medium underline decoration-dotted underline-offset-4 hover:decoration-solid"
          >
            {sourceOf(candidate, t)}
          </a>
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

function GeneralCandidates({
  choice,
  troopTypeNames,
  allowed,
  onGeneralChange,
  onFollow,
}: {
  choice: GeneralChoice;
  troopTypeNames: TroopTypeNames;
  allowed: string;
  onGeneralChange: GeneralChange;
  onFollow: () => void;
}) {
  const t = useTranslations('builder');
  const { candidates, chosen, eligible, stands } = choice;
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-pretty text-muted-foreground">
        {stands === 0
          ? t('generalNoStands', { allowed, section: t('requiredTroops') })
          : t('generalNoneEligible', { allowed })}
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => (
          <CandidateRow
            key={`${candidate.option.id}/${candidate.troopType}`}
            candidate={candidate}
            name={troopTypeNames[candidate.troopType]}
            onChoose={() => onGeneralChange(toggled(candidate))}
            onFollow={onFollow}
          />
        ))}
      </ul>

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
  );
}

const isGeneralFindingLink = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(`a[href="#${generalAnchor}"]`) !== null;

const useOpenOnGeneralFinding = (setOpen: (open: boolean) => void) => {
  useEffect(() => {
    const follow = (event: MouseEvent) => {
      if (isGeneralFindingLink(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('click', follow);
    return () => document.removeEventListener('click', follow);
  }, [setOpen]);
};

export function GeneralChip({
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
  const [open, setOpen] = useState(false);
  useOpenOnGeneralFinding(setOpen);
  const { chosen } = choice;
  const allowed = allowedTroopTypes(choice, troopTypeNames, locale);
  const leader = chosen ? troopTypeNames[chosen.troopType] : null;
  const Crown = chosen ? IconCrownFilled : IconCrown;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Badge
        id={generalAnchor}
        variant={
          chosen ? (chosen.excludedBy ? 'destructive' : 'secondary') : 'outline'
        }
        render={
          <PopoverTrigger
            aria-label={
              leader
                ? t('showGeneral', { troopType: leader })
                : t('showNoGeneral')
            }
          />
        }
      >
        <Crown />
        {leader ?? t('noGeneral')}
      </Badge>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] gap-3"
      >
        <div className="flex flex-col gap-1">
          <PopoverTitle>{t('general')}</PopoverTitle>
          <p className="text-xs text-pretty text-muted-foreground">
            {t('generalDescription', { allowed })} {t('generalHowTo')}
          </p>
        </div>
        <GeneralCandidates
          choice={choice}
          troopTypeNames={troopTypeNames}
          allowed={allowed}
          onGeneralChange={onGeneralChange}
          onFollow={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
