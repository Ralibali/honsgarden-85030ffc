import "@testing-library/jest-dom";

// IntersectionObserver saknas i jsdom – krävs bl.a. av framer-motions whileInView.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  readonly scrollMargin = "";
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  takeRecords = (): IntersectionObserverEntry[] => [];
}
if (typeof window !== "undefined") Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

if (typeof window !== "undefined") Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
