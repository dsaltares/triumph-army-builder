'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState } from 'react';
import { ArmyRow } from '@/components/army/army-row';
import type { ArmyIndexEntry } from '@/lib/data/bundle';

const estimatedRowHeight = 104;
const overscan = 6;

export function ArmyList({
  armies,
  categoryNames,
}: {
  armies: readonly ArmyIndexEntry[];
  categoryNames: ReadonlyMap<string, string>;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const measure = () => {
      setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: armies.length,
    estimateSize: () => estimatedRowHeight,
    overscan,
    scrollMargin,
  });

  return (
    <ul
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const army = armies[item.index];
        if (!army) {
          return null;
        }
        return (
          <li
            key={army.id}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
          >
            <ArmyRow
              army={army}
              categories={army.categories.flatMap((id) => {
                const name = categoryNames.get(id);
                return name ? [{ id, name }] : [];
              })}
            />
          </li>
        );
      })}
    </ul>
  );
}
