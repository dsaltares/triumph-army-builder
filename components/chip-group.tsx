'use client';

import { Button } from '@/components/ui/button';

export function ChipGroup<Value extends string | number>({
  label,
  options,
  selected,
  onToggle,
  labelFor = String,
}: {
  label: string;
  options: readonly Value[];
  selected: readonly Value[];
  onToggle: (value: Value) => void;
  labelFor?: (value: Value) => string;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-xs font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const pressed = selected.includes(option);
          return (
            <Button
              key={option}
              variant={pressed ? 'default' : 'outline'}
              size="touch"
              aria-pressed={pressed}
              onClick={() => onToggle(option)}
              className="min-w-11"
            >
              {labelFor(option)}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
