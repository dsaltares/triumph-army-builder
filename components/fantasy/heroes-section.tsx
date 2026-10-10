'use client';

import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { findingAnchorClass } from '@/components/builder/finding-anchor';
import { TagField } from '@/components/collection/tag-field';
import { ChosenCard } from '@/components/fantasy/chosen-card';
import { heroAnchor, heroesAnchor } from '@/components/fantasy/fantasy-anchors';
import { PickerDialog } from '@/components/fantasy/picker-dialog';
import { usePointsWords } from '@/components/fantasy/points-words';
import type { SelectionEdit } from '@/components/fantasy/selection-edit';
import { Section } from '@/components/layout/section';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FantasyCardCode } from '@/lib/data/schema';
import type { TagWord } from '@/lib/domain/collection/tag-words';
import {
  canAddHero,
  heroCardOffers,
  withHeroAdded,
  withHeroCard,
  withHeroCardVariant,
  withHeroDelayedEntry,
  withHeroName,
  withHeroTags,
  withoutHero,
  withoutHeroCard,
} from '@/lib/domain/fantasy/builder';
import { fantasyCardName } from '@/lib/domain/fantasy/naming';
import type { FantasyHeroPoints } from '@/lib/domain/fantasy/points';
import type { FantasyCatalogue } from '@/lib/domain/fantasy/reference';
import type {
  FantasyHero,
  FantasySelection,
} from '@/lib/domain/fantasy/selection-schema';
import { formatPoints } from '@/lib/format';

type HeroContext = {
  catalogue: FantasyCatalogue;
  selection: FantasySelection;
  onEdit: SelectionEdit;
  newId: () => string;
  tagWords: readonly TagWord[];
};

export const heroName = (hero: FantasyHero, index: number, numbered: string) =>
  hero.name.trim() || `${numbered} ${index + 1}`;

function HeroCard({
  hero,
  index,
  priced,
  context,
}: {
  hero: FantasyHero;
  index: number;
  priced: FantasyHeroPoints | undefined;
  context: HeroContext;
}) {
  const t = useTranslations('fantasyBuilder');
  const words = usePointsWords();
  const delayedId = useId();
  const { catalogue, selection, onEdit, tagWords } = context;
  const [draftTag, setDraftTag] = useState('');
  const name = heroName(hero, index, t('hero'));
  const offers = useMemo(
    () => heroCardOffers(catalogue, hero, selection.format),
    [catalogue, hero, selection.format],
  );

  return (
    <li id={heroAnchor(hero.id)} className={findingAnchorClass}>
      <Card size="sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              aria-label={t('heroName')}
              value={hero.name}
              placeholder={name}
              className="h-11 font-medium sm:h-9"
              onChange={(event) =>
                onEdit((current) =>
                  withHeroName(current, hero.id, event.target.value),
                )
              }
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('heroCost', { points: formatPoints(priced?.points ?? 0) })}
            </p>
          </div>

          <TagField
            ownWords={tagWords}
            tags={hero.tags}
            draft={draftTag}
            troopType={null}
            error={undefined}
            onDraftChange={setDraftTag}
            onTagsChange={(tags) =>
              onEdit((current) => withHeroTags(current, hero.id, tags))
            }
            onBlur={() => undefined}
          />

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{t('cards')}</h3>
            {hero.cards.length > 0 && (
              <ul className="flex flex-col gap-2">
                {hero.cards.map((choice, cardIndex) => (
                  <ChosenCard
                    key={choice.code}
                    code={choice.code}
                    card={catalogue.cards.get(choice.code)}
                    choice={choice}
                    cost={words.each(priced?.cards[cardIndex]?.points ?? null)}
                    bearer={name}
                    onRemove={() =>
                      onEdit((current) =>
                        withoutHeroCard(current, hero.id, choice.code),
                      )
                    }
                    onVariant={(variant, option) =>
                      onEdit((current) =>
                        withHeroCardVariant(
                          current,
                          hero.id,
                          choice.code,
                          variant,
                          option,
                        ),
                      )
                    }
                  />
                ))}
              </ul>
            )}
            <PickerDialog<FantasyCardCode>
              trigger={t('addCard')}
              title={t('addCardTo', { bearer: name })}
              description={t('addCardDescription')}
              empty={t('noCardsOffered')}
              groups={[
                {
                  heading: t('heroCards'),
                  options: offers.map(({ card, points }) => ({
                    value: card.code,
                    label: card.name,
                    detail: words.each(points),
                  })),
                },
              ]}
              onPick={(code) =>
                onEdit((current) => withHeroCard(current, hero.id, code))
              }
            />
          </div>

          <div className="flex min-h-11 items-center gap-2">
            <Checkbox
              id={delayedId}
              checked={hero.delayedEntry}
              onCheckedChange={(checked) =>
                onEdit((current) =>
                  withHeroDelayedEntry(current, hero.id, checked === true),
                )
              }
            />
            <Label htmlFor={delayedId}>
              {t('heroDelayed', {
                card: fantasyCardName(
                  'delayedEntry',
                  catalogue.cards.get('delayedEntry'),
                ),
              })}
            </Label>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="touch"
              aria-label={t('removeHero', { hero: name })}
              onClick={() => onEdit((current) => withoutHero(current, hero.id))}
            >
              <IconTrash data-icon="inline-start" />
              {t('remove')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

export function HeroesSection({
  priced,
  context,
}: {
  priced: readonly FantasyHeroPoints[];
  context: HeroContext;
}) {
  const t = useTranslations('fantasyBuilder');
  const { catalogue, selection, onEdit, newId } = context;
  const { heroes } = selection;
  const rules = catalogue.format.heroes;
  const addable = canAddHero(selection, catalogue.format);

  return (
    <Section
      id={heroesAnchor}
      className={findingAnchorClass}
      title={t('heroes')}
      description={t('heroesDescription', {
        max: rules.max,
        points: formatPoints(rules.maxPoints),
        cost: formatPoints(rules.cost),
      })}
    >
      {heroes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {heroes.map((hero, index) => (
            <HeroCard
              key={hero.id}
              hero={hero}
              index={index}
              priced={priced.find((candidate) => candidate.hero === hero.id)}
              context={context}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="touch"
          disabled={!addable}
          onClick={() => {
            const id = newId();
            onEdit((current) => withHeroAdded(current, id));
          }}
        >
          <IconPlus data-icon="inline-start" />
          {t('addHero')}
        </Button>
        <p className="text-xs text-muted-foreground tabular-nums">
          {addable
            ? t('heroesTaken', { count: heroes.length, max: rules.max })
            : t('heroesFull', { max: rules.max })}
        </p>
      </div>
    </Section>
  );
}
