import { describe, expect, it } from 'vitest';
import { siteName } from '@/lib/brand';

describe('test harness', () => {
  it('resolves the "@/" path alias', () => {
    expect(siteName).toBe('Triumph! Army Builder');
  });
});
