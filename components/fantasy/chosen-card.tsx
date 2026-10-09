'use client';

import { IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BundledFantasyCard } from '@/lib/data/bundle';
import type { FantasyCardCode } from '@/lib/data/schema';
import { fantasyCardName } from '@/lib/domain/fantasy/naming';
import {
  type FantasyCardChoice,
  fantasyCardNoteMaxLength,
} from '@/lib/domain/fantasy/selection-schema';

function VariantChips({
  card,
  choice,
  options,
  chosen,
  onChoose,
}: {
  card: string;
  choice: string;
  options: Readonly<Record<string, string>>;
  chosen: string | undefined;
  onChoose: (choice: string, option: string) => void;
}) {
  const t = useTranslations('fantasyBuilder');
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-xs font-medium">
        {t('chooseVariant', { card })}
      </legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([option, label]) => {
          const pressed = chosen === option;
          return (
            <Button
              key={option}
              variant={pressed ? 'default' : 'outline'}
              size="touch"
              aria-pressed={pressed}
              onClick={() => onChoose(choice, option)}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CardNote({
  card,
  note,
  onNote,
}: {
  card: string;
  note: string;
  onNote: (note: string) => void;
}) {
  const t = useTranslations('fantasyBuilder');
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {t('cardNote', { card })}
      </Label>
      <Input
        id={id}
        value={note}
        maxLength={fantasyCardNoteMaxLength}
        placeholder={t('cardNotePlaceholder')}
        className="h-11 sm:h-9"
        onChange={(event) => onNote(event.target.value)}
      />
    </div>
  );
}

export function ChosenCard({
  code,
  card,
  choice,
  cost,
  bearer,
  onRemove,
  onVariant,
  onNote,
  children,
}: {
  code: FantasyCardCode;
  card: BundledFantasyCard | undefined;
  choice: Pick<FantasyCardChoice, 'variants' | 'note'>;
  cost: string;
  bearer: string;
  onRemove: () => void;
  onVariant: (choice: string, option: string) => void;
  onNote?: ((note: string) => void) | undefined;
  children?: ReactNode;
}) {
  const t = useTranslations('fantasyBuilder');
  const name = fantasyCardName(code, card);
  return (
    <li className="flex flex-col gap-2 rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium">{name}</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {cost}
        </span>
        <Button
          variant="ghost"
          size="icon-touch"
          aria-label={t('removeCard', { card: name, bearer })}
          onClick={onRemove}
        >
          <IconX />
        </Button>
      </div>
      {Object.entries(card?.variants ?? {}).map(([variant, options]) => (
        <VariantChips
          key={variant}
          card={name}
          choice={variant}
          options={options}
          chosen={choice.variants?.[variant]}
          onChoose={onVariant}
        />
      ))}
      {onNote && (
        <CardNote card={name} note={choice.note ?? ''} onNote={onNote} />
      )}
      {children}
    </li>
  );
}
