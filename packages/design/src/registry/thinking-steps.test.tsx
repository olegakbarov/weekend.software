import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  ThinkingStep,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from "./thinking-steps";

describe("ThinkingSteps", () => {
  it("renders the header trigger with content-shrinking pill (`w-fit` wrapper)", () => {
    const { container } = render(
      <ThinkingSteps>
        <ThinkingStepsHeader>Researching</ThinkingStepsHeader>
        <ThinkingStepsContent>
          <ThinkingStep label="step" status="complete" isLast />
        </ThinkingStepsContent>
      </ThinkingSteps>,
    );
    // The trigger is wrapped in a w-fit div so the header doesn't span the full width.
    const wfit = container.querySelector(".w-fit");
    expect(wfit).toBeTruthy();
    const trigger = wfit?.querySelector('button[data-state]');
    expect(trigger).toBeTruthy();
    expect(trigger?.className).toContain("w-auto");
  });

  it("hides the standalone Accordion's expanded background via [&>.absolute]:hidden", () => {
    const { container } = render(
      <ThinkingSteps>
        <ThinkingStepsHeader>Researching</ThinkingStepsHeader>
        <ThinkingStepsContent>
          <ThinkingStep label="step" status="complete" isLast />
        </ThinkingStepsContent>
      </ThinkingSteps>,
    );
    // The AccordionItem (value="thinking") receives the suppressor class.
    const anyWithItemClass = Array.from(
      container.querySelectorAll<HTMLDivElement>("div"),
    ).find((el) => el.className.includes("[&>.absolute]:hidden"));
    expect(anyWithItemClass).toBeTruthy();
  });

  it("active step gets shimmer-text class on the label", () => {
    const { container } = render(
      <ThinkingSteps>
        <ThinkingStepsHeader>Researching</ThinkingStepsHeader>
        <ThinkingStepsContent>
          <ThinkingStep label="thinking..." status="active" isLast />
        </ThinkingStepsContent>
      </ThinkingSteps>,
    );
    const shimmer = container.querySelector(".shimmer-text");
    expect(shimmer).toBeTruthy();
    expect(shimmer?.textContent).toContain("thinking...");
  });

  it("renders pending step as null", () => {
    const { queryByText } = render(
      <ThinkingSteps>
        <ThinkingStepsHeader>Researching</ThinkingStepsHeader>
        <ThinkingStepsContent>
          <ThinkingStep label="pending-label" status="pending" />
          <ThinkingStep label="visible-label" status="complete" isLast />
        </ThinkingStepsContent>
      </ThinkingSteps>,
    );
    expect(queryByText("pending-label")).toBeNull();
    expect(queryByText("visible-label")).toBeTruthy();
  });

  it("ThinkingStepSource renders a Badge with the supplied label", () => {
    const { getByText } = render(
      <ThinkingStepSources>
        <ThinkingStepSource color="blue">npmjs.com</ThinkingStepSource>
      </ThinkingStepSources>,
    );
    expect(getByText("npmjs.com")).toBeTruthy();
  });
});
