import "@testing-library/react";

// jsdom doesn't implement these — stub so components don't blow up under test.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= function () {};
  Element.prototype.scrollTo ??= function () {};
  // jsdom 25 ships pointer-event listeners but not the constructor; without it,
  // testing-library's fireEvent silently downgrades to a generic Event and
  // strips clientX/pointerType etc. Provide a minimal PointerEvent polyfill.
  if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      width: number;
      height: number;
      pressure: number;
      tangentialPressure: number;
      tiltX: number;
      tiltY: number;
      twist: number;
      isPrimary: boolean;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.pointerType = params.pointerType ?? "";
        this.width = params.width ?? 1;
        this.height = params.height ?? 1;
        this.pressure = params.pressure ?? 0;
        this.tangentialPressure = params.tangentialPressure ?? 0;
        this.tiltX = params.tiltX ?? 0;
        this.tiltY = params.tiltY ?? 0;
        this.twist = params.twist ?? 0;
        this.isPrimary = params.isPrimary ?? false;
      }
    }
    (globalThis as { PointerEvent?: unknown }).PointerEvent = PointerEventPolyfill;
  }
  // Pointer-capture stubs — jsdom doesn't track them.
  HTMLElement.prototype.setPointerCapture ??= function () {};
  HTMLElement.prototype.releasePointerCapture ??= function () {};
  HTMLElement.prototype.hasPointerCapture ??= function () {
    return false;
  };
}

// ResizeObserver stub — Radix Slider's `useSize` and ours both invoke it.
if (typeof globalThis !== "undefined" && !("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
    ResizeObserverStub;
}
