import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  Test,
  TestError,
  TestErrorMessage,
  TestResults,
  TestResultsContent,
  TestResultsDuration,
  TestResultsHeader,
  TestResultsProgress,
  TestResultsSummary,
  TestSuite,
  TestSuiteContent,
  TestSuiteName,
  TestSuiteStats,
} from "./test-results";

describe("TestResults", () => {
  it("renders the default header when summary is provided and no children", () => {
    const { getByText } = render(
      <TestResults
        summary={{ passed: 3, failed: 1, skipped: 2, total: 6, duration: 1234 }}
      />,
    );
    expect(getByText("3 passed")).toBeTruthy();
    expect(getByText("1 failed")).toBeTruthy();
    expect(getByText("2 skipped")).toBeTruthy();
    expect(getByText("1.23s")).toBeTruthy();
  });

  it("hides failed/skipped pills when their counts are zero", () => {
    const { queryByText, getByText } = render(
      <TestResults
        summary={{ passed: 5, failed: 0, skipped: 0, total: 5 }}
      />,
    );
    expect(getByText("5 passed")).toBeTruthy();
    expect(queryByText(/failed$/)).toBeNull();
    expect(queryByText(/skipped$/)).toBeNull();
  });

  it("renders sub-second durations in ms and second-plus durations as decimal seconds", () => {
    const { getByText, rerender } = render(
      <TestResults summary={{ passed: 1, failed: 0, skipped: 0, total: 1, duration: 250 }}>
        <TestResultsHeader>
          <TestResultsDuration />
        </TestResultsHeader>
      </TestResults>,
    );
    expect(getByText("250ms")).toBeTruthy();

    rerender(
      <TestResults summary={{ passed: 1, failed: 0, skipped: 0, total: 1, duration: 4500 }}>
        <TestResultsHeader>
          <TestResultsDuration />
        </TestResultsHeader>
      </TestResults>,
    );
    expect(getByText("4.50s")).toBeTruthy();
  });

  it("renders TestResultsProgress with passed-percentage label", () => {
    const { getByText } = render(
      <TestResults summary={{ passed: 3, failed: 1, skipped: 0, total: 4 }}>
        <TestResultsContent>
          <TestResultsProgress />
        </TestResultsContent>
      </TestResults>,
    );
    expect(getByText("3/4 tests passed")).toBeTruthy();
    expect(getByText("75%")).toBeTruthy();
  });

  it("returns null from progress when summary is absent or total is zero", () => {
    const { container, rerender } = render(
      <TestResults>
        <TestResultsProgress />
      </TestResults>,
    );
    expect(container.querySelector("[style*='width']")).toBeNull();

    rerender(
      <TestResults summary={{ passed: 0, failed: 0, skipped: 0, total: 0 }}>
        <TestResultsProgress />
      </TestResults>,
    );
    expect(container.querySelector("[style*='width']")).toBeNull();
  });

  it("returns null from TestResultsSummary when no summary is provided", () => {
    const { queryByText } = render(
      <TestResults>
        <TestResultsHeader>
          <TestResultsSummary />
        </TestResultsHeader>
      </TestResults>,
    );
    expect(queryByText(/passed/)).toBeNull();
  });
});

describe("TestSuite", () => {
  it("renders collapsed by default and reveals content on trigger click", () => {
    const { getByText, queryByText, container } = render(
      <TestSuite name="auth flow" status="passed">
        <TestSuiteName />
        <TestSuiteContent>
          <Test name="logs in with valid credentials" status="passed" />
        </TestSuiteContent>
      </TestSuite>,
    );
    expect(getByText("auth flow")).toBeTruthy();
    expect(queryByText("logs in with valid credentials")).toBeNull();

    const trigger = container.querySelector("button");
    fireEvent.click(trigger!);
    expect(getByText("logs in with valid credentials")).toBeTruthy();
  });

  it("respects a controlled open state via Collapsible's open prop", () => {
    const { getByText } = render(
      <TestSuite name="api" status="failed" open>
        <TestSuiteName />
        <TestSuiteContent>
          <Test name="fetches users" status="failed" />
        </TestSuiteContent>
      </TestSuite>,
    );
    expect(getByText("fetches users")).toBeTruthy();
  });

  it("renders TestSuiteStats only for non-zero counts", () => {
    const { getByText, queryByText } = render(
      <TestSuiteStats passed={4} failed={0} skipped={1} />,
    );
    expect(getByText("4 passed")).toBeTruthy();
    expect(getByText("1 skipped")).toBeTruthy();
    expect(queryByText(/failed/)).toBeNull();
  });
});

describe("Test row", () => {
  it("renders the duration when provided and omits it otherwise", () => {
    const { getByText, queryByText, rerender } = render(
      <Test name="case a" status="passed" duration={42} />,
    );
    expect(getByText("case a")).toBeTruthy();
    expect(getByText("42ms")).toBeTruthy();

    rerender(<Test name="case b" status="skipped" />);
    expect(queryByText(/ms$/)).toBeNull();
  });

  it("renders TestError content inline", () => {
    const { getByText } = render(
      <Test name="explodes" status="failed">
        <TestError>
          <TestErrorMessage>boom</TestErrorMessage>
        </TestError>
      </Test>,
    );
    expect(getByText("boom")).toBeTruthy();
  });
});
