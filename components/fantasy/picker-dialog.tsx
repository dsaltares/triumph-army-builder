'use client';

import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export type PickerOption<Value extends string> = {
  value: Value;
  label: string;
  detail?: string;
};

export type PickerGroup<Value extends string> = {
  heading: string;
  options: readonly PickerOption<Value>[];
};

export function PickerDialog<Value extends string>({
  trigger,
  title,
  description,
  groups,
  empty,
  disabled = false,
  onPick,
}: {
  trigger: string;
  title: string;
  description?: string;
  groups: readonly PickerGroup<Value>[];
  empty: string;
  disabled?: boolean;
  onPick: (value: Value) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = groups.filter(({ options }) => options.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="touch"
            className="self-start"
            disabled={disabled}
          />
        }
      >
        <IconPlus data-icon="inline-start" />
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="-mx-2 flex max-h-[60dvh] flex-col gap-3 overflow-y-auto overscroll-contain">
            {shown.map(({ heading, options }) => (
              <section
                key={heading}
                aria-label={heading}
                className="flex flex-col"
              >
                <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                  {heading}
                </h3>
                <ul>
                  {options.map(({ value, label, detail }) => (
                    <li key={value}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick(value);
                          setOpen(false);
                        }}
                        className="flex min-h-11 w-full items-baseline justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className="text-sm font-medium">{label}</span>
                        {detail && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {detail}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
