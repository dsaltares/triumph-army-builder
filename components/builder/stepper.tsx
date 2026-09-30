import { IconMinus, IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type StepperInput = {
  id: string;
  invalid?: boolean;
  describedBy?: string | undefined;
  onBlur?: () => void;
};

export type StepperProps = {
  count: number;
  countLabel: string;
  removeLabel: string;
  addLabel: string;
  canAdd: boolean;
  canRemove: boolean;
  onChange: (count: number) => void;
  input?: StepperInput;
};

const typedCount = (typed: string) =>
  typed === '' ? Number.NaN : Number(typed);

export function Stepper({
  count,
  countLabel,
  removeLabel,
  addLabel,
  canAdd,
  canRemove,
  onChange,
  input,
}: StepperProps) {
  const current = Number.isFinite(count) ? count : 0;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-touch"
        aria-label={removeLabel}
        disabled={!canRemove}
        onClick={() => onChange(current - 1)}
      >
        <IconMinus />
      </Button>
      {input ? (
        <Input
          id={input.id}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className="h-11 w-16 text-center text-sm font-semibold tabular-nums sm:h-9"
          value={Number.isFinite(count) ? count : ''}
          aria-invalid={input.invalid}
          aria-describedby={input.describedBy}
          onChange={(event) => onChange(typedCount(event.target.value))}
          onBlur={input.onBlur}
        />
      ) : (
        <output
          aria-label={countLabel}
          className="w-8 text-center text-sm font-semibold tabular-nums"
        >
          {count}
        </output>
      )}
      <Button
        variant="outline"
        size="icon-touch"
        aria-label={addLabel}
        disabled={!canAdd}
        onClick={() => onChange(current + 1)}
      >
        <IconPlus />
      </Button>
    </div>
  );
}
