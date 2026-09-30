import { afterEach } from 'vitest';

type Beacon = { url: string; body: unknown };

const sent: Beacon[] = [];

const bodyOf = (data: BodyInit | null | undefined) =>
  typeof data === 'string' ? JSON.parse(data) : data;

export const recordBeacons = () => {
  Object.defineProperty(window.navigator, 'sendBeacon', {
    configurable: true,
    value: (url: string, data?: BodyInit | null) => {
      sent.push({ url, body: bodyOf(data) });
      return true;
    },
  });
  afterEach(() => {
    sent.length = 0;
  });
};

export const sentBeacons = () => [...sent];
