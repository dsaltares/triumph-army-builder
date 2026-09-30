import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { recordBeacons } from './beacons.ts';

const matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const absoluteUrl = (url: string) => new URL(url, window.location.href).href;

const resolveRelativeUrlsAgainstLocation = () => {
  const { fetch: nodeFetch } = globalThis;
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    nodeFetch(typeof input === 'string' ? absoluteUrl(input) : input, init);
};

const stubBrowserApisTheDomImplementationMayLack = () => {
  window.matchMedia ??= matchMedia as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??=
    ObserverStub as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??=
    ObserverStub as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
};

stubBrowserApisTheDomImplementationMayLack();
resolveRelativeUrlsAgainstLocation();
recordBeacons();

afterEach(cleanup);
