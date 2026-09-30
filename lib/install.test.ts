import { describe, expect, it } from 'vitest';
import {
  decodeInstallRecord,
  installPlatform,
  shouldPromptInstall,
} from './install.ts';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ipad =
  'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
const mac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const android =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const windows =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

describe('installPlatform', () => {
  it('recognises an iPhone and an older iPad', () => {
    expect(installPlatform({ userAgent: iphone, maxTouchPoints: 5 })).toBe(
      'ios',
    );
    expect(installPlatform({ userAgent: ipad, maxTouchPoints: 5 })).toBe('ios');
  });

  it('recognises an iPad that claims to be a Mac', () => {
    expect(installPlatform({ userAgent: mac, maxTouchPoints: 5 })).toBe('ios');
  });

  it('recognises Android', () => {
    expect(installPlatform({ userAgent: android, maxTouchPoints: 5 })).toBe(
      'android',
    );
  });

  it('leaves a desktop alone', () => {
    expect(installPlatform({ userAgent: mac, maxTouchPoints: 0 })).toBeNull();
    expect(
      installPlatform({ userAgent: windows, maxTouchPoints: 0 }),
    ).toBeNull();
  });
});

describe('shouldPromptInstall', () => {
  const record = {
    visits: 1,
    savedAList: false,
    dismissed: false,
  };

  it('holds its tongue on a first visit', () => {
    expect(shouldPromptInstall(record)).toBe(false);
  });

  it('asks on a second visit', () => {
    expect(shouldPromptInstall({ ...record, visits: 2 })).toBe(true);
  });

  it('asks as soon as a list has been saved', () => {
    expect(shouldPromptInstall({ ...record, savedAList: true })).toBe(true);
  });

  it('never asks again once it has been turned down', () => {
    expect(
      shouldPromptInstall({ visits: 9, savedAList: true, dismissed: true }),
    ).toBe(false);
  });
});

describe('decodeInstallRecord', () => {
  it('starts from nothing when there is nothing to read', () => {
    expect(decodeInstallRecord(null)).toEqual({
      visits: 0,
      savedAList: false,
      dismissed: false,
    });
  });

  it('starts from nothing when what is stored is not a record', () => {
    expect(decodeInstallRecord('not json')).toEqual(decodeInstallRecord(null));
    expect(decodeInstallRecord('{"visits":"many"}')).toEqual(
      decodeInstallRecord(null),
    );
  });

  it('reads back what was stored', () => {
    const record = { visits: 3, savedAList: true, dismissed: false };

    expect(decodeInstallRecord(JSON.stringify(record))).toEqual(record);
  });
});
