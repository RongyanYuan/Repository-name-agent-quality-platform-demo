import '@testing-library/jest-dom/vitest'

if (!globalThis.ResizeObserver) {
  class ResizeObserverStub {
    private callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) { this.callback = callback }
    observe(target: Element) { this.callback([{ contentRect: { width: 640, height: 240 }, target } as ResizeObserverEntry], this as unknown as ResizeObserver) }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as typeof ResizeObserver
}
