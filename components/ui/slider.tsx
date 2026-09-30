'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function Slider({ className, ...props }: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('w-full', className)}
      {...props}
    />
  );
}

function SliderControl({ className, ...props }: SliderPrimitive.Control.Props) {
  return (
    <SliderPrimitive.Control
      data-slot="slider-control"
      className={cn(
        'flex w-full touch-none items-center py-3 select-none',
        className,
      )}
      {...props}
    />
  );
}

function SliderTrack({ className, ...props }: SliderPrimitive.Track.Props) {
  return (
    <SliderPrimitive.Track
      data-slot="slider-track"
      className={cn('h-1.5 w-full rounded-full bg-muted select-none', className)}
      {...props}
    />
  );
}

function SliderIndicator({
  className,
  ...props
}: SliderPrimitive.Indicator.Props) {
  return (
    <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className={cn('rounded-full bg-primary select-none', className)}
      {...props}
    />
  );
}

function SliderThumb({ className, ...props }: SliderPrimitive.Thumb.Props) {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        'size-5 rounded-full border-2 border-primary bg-background shadow-sm transition-shadow select-none after:absolute after:-inset-3 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring data-dragging:ring-2 data-dragging:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function SliderMark({
  className,
  position,
  style,
  ...props
}: ComponentProps<'span'> & { position: number }) {
  return (
    <span
      data-slot="slider-mark"
      className={cn(
        'absolute top-full h-2 w-1 -translate-x-1/2 translate-y-1 rounded-full bg-muted-foreground/70 transition-colors hover:bg-foreground',
        className,
      )}
      style={{ insetInlineStart: `${position * 100}%`, ...style }}
      {...props}
    />
  );
}

export {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderMark,
  SliderThumb,
  SliderTrack,
};
