'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUpdateArmy } from '@/components/army/use-saved-armies';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import {
  type SavedSelection,
  savedSelectionOf,
} from '@/lib/domain/army/selection-schema';
import { encodeShareCode } from '@/lib/domain/army/share-codec';

export const autosaveQuietMs = 1200;

export type AutosaveStatus = 'saved' | 'saving' | 'failed';

export type AutosaveInput = {
  saved: SavedArmy;
  listName: string;
  list: SavedSelection;
};

type Write = SavedSelection & {
  id: string;
  name: string;
};

const outstanding = (
  saved: SavedArmy,
  listName: string,
  list: SavedSelection,
): Write | null => {
  const name = listName.trim();
  if (!name) {
    return null;
  }
  const changed =
    name !== saved.name ||
    encodeShareCode(list) !== encodeShareCode(savedSelectionOf(saved));
  return changed ? { ...list, id: saved.id, name } : null;
};

export const useAutosave = ({ saved, listName, list }: AutosaveInput) => {
  const update = useUpdateArmy();
  const [failed, setFailed] = useState(false);

  const pending = useMemo(
    () => outstanding(saved, listName, list),
    [saved, listName, list],
  );

  const latest = useRef(pending);
  latest.current = pending;

  const mutate = useRef(update.mutateAsync);
  mutate.current = update.mutateAsync;

  const writing = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((write: Write) => {
    writing.current = true;
    startedAt.current = Date.now();
    const written = mutate
      .current(write)
      .then(() => {
        setFailed(false);
        return true;
      })
      .catch(() => {
        setFailed(true);
        return false;
      })
      .finally(() => {
        writing.current = false;
        inFlight.current = null;
      });
    inFlight.current = written;
    return written;
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) {
      return;
    }
    const quiet = Math.max(
      0,
      autosaveQuietMs - (Date.now() - startedAt.current),
    );
    timer.current = setTimeout(() => {
      timer.current = null;
      const write = latest.current;
      if (!write || writing.current) {
        return;
      }
      void send(write).then((written) => {
        if (written && latest.current) {
          schedule();
        }
      });
    }, quiet);
  }, [send]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const write = latest.current;
    if (write) {
      void send(write);
    }
  }, [send]);

  useEffect(() => {
    if (pending) {
      schedule();
    }
  }, [pending, schedule]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const write = latest.current;
      if (write) {
        void mutate.current(write).catch(() => {});
      }
    },
    [],
  );

  const settle = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) {
      await inFlight.current;
    }
    const write = latest.current;
    if (write) {
      await send(write);
    }
  }, [send]);

  const retry = useCallback(() => {
    setFailed(false);
    flush();
  }, [flush]);

  const status: AutosaveStatus = failed
    ? 'failed'
    : pending || update.isPending
      ? 'saving'
      : 'saved';

  return { status, retry, settle };
};
