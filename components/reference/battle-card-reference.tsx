import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Section } from '@/components/layout/section';
import { MarkdownProse } from '@/components/reference/markdown-prose';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { BattleCardCategory } from '@/lib/domain/battle-cards/cost-rules';
import {
  battleCardReference,
  type DescribedCard,
  type ReferenceCard,
  type ReferenceCardGroup,
} from '@/lib/domain/battle-cards/reference';
import { parseMarkdown } from '@/lib/markdown';

const categoryLabels = {
  army: 'armyBattleCards',
  troop: 'troopBattleCards',
} as const satisfies Record<BattleCardCategory, string>;

const categoryDescriptions = {
  army: 'armyBattleCardsDescription',
  troop: 'troopBattleCardsDescription',
} as const satisfies Record<BattleCardCategory, string>;

const cardNote = (
  { showInList, listName, displayName }: ReferenceCard,
  t: ReturnType<typeof useTranslations<'armies'>>,
) => {
  if (!showInList) {
    return t('cardNotPrinted');
  }
  return listName === displayName ? null : t('printedAs', { name: listName });
};

function BattleCardEntry({ card }: { card: ReferenceCard }) {
  const t = useTranslations('armies');
  const note = cardNote(card, t);
  return (
    <li>
      <details
        id={card.permanentCode}
        className="group scroll-mt-20 rounded-lg border bg-card"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
          <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <h3 className="font-heading text-sm font-semibold tracking-tight">
            {card.displayName}
          </h3>
          <Badge variant="outline">{card.permanentCode}</Badge>
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3 pl-9">
          {note && (
            <Alert variant="info" className="max-w-reading">
              <IconInfoCircle />
              <AlertDescription>{note}</AlertDescription>
            </Alert>
          )}
          <MarkdownProse blocks={parseMarkdown(card.text)} headingLevel={4} />
        </div>
      </details>
    </li>
  );
}

function BattleCardGroupSection({ group }: { group: ReferenceCardGroup }) {
  const t = useTranslations('armies');
  return (
    <Section
      title={t(categoryLabels[group.category])}
      description={t(categoryDescriptions[group.category])}
    >
      <ul className="flex flex-col gap-2">
        {group.cards.map((card) => (
          <BattleCardEntry key={card.permanentCode} card={card} />
        ))}
      </ul>
    </Section>
  );
}

export function BattleCardReference({
  cards,
  text,
}: {
  cards: readonly DescribedCard[];
  text: Readonly<Record<DescribedCard['permanentCode'], string>>;
}) {
  return battleCardReference(cards, text).map((group) => (
    <BattleCardGroupSection key={group.category} group={group} />
  ));
}
