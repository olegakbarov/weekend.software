import "@testing-library/react";

// jsdom doesn't implement these — stub so components don't blow up under test.
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView ??= function () {};
}
