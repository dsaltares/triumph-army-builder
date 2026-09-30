'use client';

import type { ComboboxRootChangeEventReason } from '@base-ui/react/combobox';
import type { KeyboardEvent } from 'react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';

export type AutocompleteInputReason = ComboboxRootChangeEventReason;

type AutocompleteBase<Value extends string> = {
  id: string;
  label: string;
  options: readonly Value[];
  optionLabel?: ((value: Value) => string) | undefined;
  empty: string;
  describedBy?: string | undefined;
  invalid?: boolean | undefined;
  filtered?: boolean | undefined;
  inputValue?: string | undefined;
  onInputValueChange?:
    | ((inputValue: string, reason: AutocompleteInputReason) => void)
    | undefined;
  onInputKeyDown?:
    | ((event: KeyboardEvent<HTMLInputElement>) => void)
    | undefined;
  onBlur?: (() => void) | undefined;
};

type SingleAutocomplete<Value extends string> = AutocompleteBase<Value> & {
  multiple?: false;
  value: Value | null;
  onValueChange: (value: Value | null) => void;
};

type MultipleAutocomplete<Value extends string> = AutocompleteBase<Value> & {
  multiple: true;
  value: readonly Value[];
  onValueChange: (value: Value[]) => void;
  removeLabel: (value: Value) => string;
};

export type AutocompleteProps<Value extends string> =
  | SingleAutocomplete<Value>
  | MultipleAutocomplete<Value>;

const clearsOnEscape = (reason: AutocompleteInputReason) =>
  reason === 'escape-key';

const touchInput = 'h-11 text-sm sm:h-9';

const visibleFocus =
  'has-[[data-slot=input-group-control]:focus-visible]:ring-ring focus-within:ring-ring';

function Options<Value extends string>({
  empty,
  optionLabel,
  anchor,
}: {
  empty: string;
  optionLabel: (value: Value) => string;
  anchor?: ReturnType<typeof useComboboxAnchor>;
}) {
  return (
    <ComboboxContent anchor={anchor}>
      <ComboboxEmpty>{empty}</ComboboxEmpty>
      <ComboboxList>
        {(option: Value) => (
          <ComboboxItem
            key={option}
            value={option}
            className="min-h-11 sm:min-h-7"
          >
            {optionLabel(option)}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  );
}

function MultipleField<Value extends string>({
  id,
  value,
  removeLabel,
  optionLabel,
  describedBy,
  invalid,
  onInputKeyDown,
  onBlur,
  anchor,
}: Pick<
  MultipleAutocomplete<Value>,
  | 'id'
  | 'value'
  | 'removeLabel'
  | 'describedBy'
  | 'invalid'
  | 'onInputKeyDown'
  | 'onBlur'
> & {
  optionLabel: (value: Value) => string;
  anchor: ReturnType<typeof useComboboxAnchor>;
}) {
  return (
    <ComboboxChips
      ref={anchor}
      className={`min-h-11 gap-1 py-1 sm:min-h-9 ${visibleFocus}`}
    >
      <ComboboxValue>
        {value.map((selected) => (
          <ComboboxChip
            key={selected}
            className="h-8 gap-1 px-2 text-sm sm:h-6 sm:text-xs"
            removeLabel={removeLabel(selected)}
          >
            {optionLabel(selected)}
          </ComboboxChip>
        ))}
      </ComboboxValue>
      <ComboboxChipsInput
        id={id}
        className="h-8 bg-transparent text-sm sm:h-6 sm:text-xs"
        autoComplete="off"
        autoCapitalize="none"
        enterKeyHint="done"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onKeyDown={onInputKeyDown}
        onBlur={onBlur}
      />
    </ComboboxChips>
  );
}

export function Autocomplete<Value extends string>(
  props: AutocompleteProps<Value>,
) {
  const {
    id,
    label,
    options,
    optionLabel = String,
    empty,
    describedBy,
    invalid,
    filtered = true,
    inputValue,
    onInputValueChange,
    onInputKeyDown,
    onBlur,
  } = props;
  const anchor = useComboboxAnchor();
  const shared = {
    items: options,
    itemToStringLabel: optionLabel,
    autoHighlight: true,
    ...(filtered ? {} : { filter: null }),
    ...(inputValue === undefined ? {} : { inputValue }),
    ...(onInputValueChange && {
      onInputValueChange: (
        typed: string,
        { reason }: { reason: AutocompleteInputReason },
      ) => onInputValueChange(typed, reason),
    }),
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {props.multiple ? (
        <Combobox
          {...shared}
          multiple
          value={[...props.value]}
          onValueChange={(next: Value[], { reason }) => {
            if (!clearsOnEscape(reason)) {
              props.onValueChange(next);
            }
          }}
        >
          <MultipleField
            id={id}
            value={props.value}
            removeLabel={props.removeLabel}
            optionLabel={optionLabel}
            describedBy={describedBy}
            invalid={invalid}
            onInputKeyDown={onInputKeyDown}
            onBlur={onBlur}
            anchor={anchor}
          />
          <Options empty={empty} optionLabel={optionLabel} anchor={anchor} />
        </Combobox>
      ) : (
        <Combobox
          {...shared}
          value={props.value}
          onValueChange={(next: Value | null, { reason }) => {
            if (!clearsOnEscape(reason)) {
              props.onValueChange(next);
            }
          }}
        >
          <ComboboxInput
            id={id}
            className={`${touchInput} w-full ${visibleFocus}`}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onKeyDown={onInputKeyDown}
            onBlur={onBlur}
          />
          <Options empty={empty} optionLabel={optionLabel} />
        </Combobox>
      )}
    </div>
  );
}
