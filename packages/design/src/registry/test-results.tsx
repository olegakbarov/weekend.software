"use client";

import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Circle,
  XCircle,
} from "lucide-react";
import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "../lib/cn";
import { Badge, BADGE_HEX, type BadgeColor } from "./badge";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TestCaseStatus = "passed" | "failed" | "skipped" | "running";

export interface TestRunSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
}

// ─── Status → token / icon maps ─────────────────────────────────────────────
// Weekend semantic tokens. The four themes (fluid, fluid-dark, weekend-dark,
// weekend-paper) each redefine these so the same className renders correct
// hue + contrast across themes without per-theme overrides.

const statusTextClass: Record<TestCaseStatus, string> = {
  passed: "text-success",
  failed: "text-destructive",
  skipped: "text-warning",
  // No semantic "info" token in Weekend — primary resolves to foreground gray.
  // Pulse signals activity; a tinted CircleDot reads as in-progress.
  running: "text-foreground/70 animate-pulse",
};

const statusIcons: Record<TestCaseStatus, ReactNode> = {
  passed: <CheckCircle2 className="size-4" />,
  failed: <XCircle className="size-4" />,
  skipped: <Circle className="size-4" />,
  running: <CircleDot className="size-4" />,
};

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

function StatusGlyph({ status }: { status: TestCaseStatus }) {
  return (
    <span className={cn("shrink-0", statusTextClass[status])}>
      {statusIcons[status]}
    </span>
  );
}

// Saturated, hue-matched text on the summary pills. Uses color-mix against
// the theme's --foreground so the text darkens in light themes and lightens
// in dark themes — readable on the 15% tinted background the Badge produces.
const tintedTextStyle = (color: BadgeColor): React.CSSProperties => ({
  color: `color-mix(in srgb, ${BADGE_HEX[color]} 65%, var(--foreground))`,
});

// ─── TestResults (root) ─────────────────────────────────────────────────────

interface TestResultsContextValue {
  summary: TestRunSummary | undefined;
}

const TestResultsContext = createContext<TestResultsContextValue>({
  summary: undefined,
});

export type TestResultsProps = HTMLAttributes<HTMLDivElement> & {
  summary?: TestRunSummary;
};

export const TestResults = forwardRef<HTMLDivElement, TestResultsProps>(
  function TestResults({ summary, className, children, ...props }, ref) {
    const ctx = useMemo(() => ({ summary }), [summary]);

    return (
      <TestResultsContext.Provider value={ctx}>
        <div
          ref={ref}
          className={cn(
            "rounded-lg border border-border bg-background",
            className,
          )}
          {...props}
        >
          {children ??
            (summary && (
              <TestResultsHeader>
                <TestResultsSummary />
                <TestResultsDuration />
              </TestResultsHeader>
            ))}
        </div>
      </TestResultsContext.Provider>
    );
  },
);

// ─── TestResultsHeader ──────────────────────────────────────────────────────

export type TestResultsHeaderProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsHeader = forwardRef<
  HTMLDivElement,
  TestResultsHeaderProps
>(function TestResultsHeader({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between border-b border-border px-4 py-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// ─── TestResultsSummary ─────────────────────────────────────────────────────

export type TestResultsSummaryProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsSummary = forwardRef<
  HTMLDivElement,
  TestResultsSummaryProps
>(function TestResultsSummary({ className, children, ...props }, ref) {
  const { summary } = useContext(TestResultsContext);

  if (!summary) return null;

  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-2", className)}
      {...props}
    >
      {children ?? (
        <>
          <Badge
            variant="solid"
            size="sm"
            color="green"
            className="gap-1"
            style={tintedTextStyle("green")}
          >
            <CheckCircle2 className="size-3" />
            {summary.passed} passed
          </Badge>
          {summary.failed > 0 && (
            <Badge
              variant="solid"
              size="sm"
              color="red"
              className="gap-1"
              style={tintedTextStyle("red")}
            >
              <XCircle className="size-3" />
              {summary.failed} failed
            </Badge>
          )}
          {summary.skipped > 0 && (
            <Badge
              variant="solid"
              size="sm"
              color="yellow"
              className="gap-1"
              style={tintedTextStyle("yellow")}
            >
              <Circle className="size-3" />
              {summary.skipped} skipped
            </Badge>
          )}
        </>
      )}
    </div>
  );
});

// ─── TestResultsDuration ────────────────────────────────────────────────────

export type TestResultsDurationProps = HTMLAttributes<HTMLSpanElement>;

export const TestResultsDuration = forwardRef<
  HTMLSpanElement,
  TestResultsDurationProps
>(function TestResultsDuration({ className, children, ...props }, ref) {
  const { summary } = useContext(TestResultsContext);

  if (!summary?.duration) return null;

  return (
    <span
      ref={ref}
      className={cn("text-[13px] text-muted-foreground", className)}
      {...props}
    >
      {children ?? formatDuration(summary.duration)}
    </span>
  );
});

// ─── TestResultsProgress ────────────────────────────────────────────────────

export type TestResultsProgressProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsProgress = forwardRef<
  HTMLDivElement,
  TestResultsProgressProps
>(function TestResultsProgress({ className, children, ...props }, ref) {
  const { summary } = useContext(TestResultsContext);

  if (!summary || summary.total === 0) return null;

  const passedPercent = (summary.passed / summary.total) * 100;
  const failedPercent = (summary.failed / summary.total) * 100;

  return (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      {children ?? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-success transition-all"
              style={{ width: `${passedPercent}%` }}
            />
            <div
              className="bg-destructive transition-all"
              style={{ width: `${failedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[12px] text-muted-foreground">
            <span>
              {summary.passed}/{summary.total} tests passed
            </span>
            <span>{passedPercent.toFixed(0)}%</span>
          </div>
        </>
      )}
    </div>
  );
});

// ─── TestResultsContent ─────────────────────────────────────────────────────

export type TestResultsContentProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsContent = forwardRef<
  HTMLDivElement,
  TestResultsContentProps
>(function TestResultsContent({ className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn("space-y-2 p-4", className)} {...props}>
      {children}
    </div>
  );
});

// ─── TestSuite ──────────────────────────────────────────────────────────────

interface TestSuiteContextValue {
  name: string;
  status: TestCaseStatus;
}

const TestSuiteContext = createContext<TestSuiteContextValue>({
  name: "",
  status: "passed",
});

export type TestSuiteProps = ComponentProps<typeof CollapsiblePrimitive.Root> & {
  name: string;
  status: TestCaseStatus;
};

export const TestSuite = ({
  name,
  status,
  className,
  children,
  ...props
}: TestSuiteProps) => {
  const ctx = useMemo(() => ({ name, status }), [name, status]);

  return (
    <TestSuiteContext.Provider value={ctx}>
      <CollapsiblePrimitive.Root
        className={cn("rounded-lg border border-border", className)}
        {...props}
      >
        {children}
      </CollapsiblePrimitive.Root>
    </TestSuiteContext.Provider>
  );
};

export type TestSuiteNameProps = ComponentProps<
  typeof CollapsiblePrimitive.Trigger
>;

export const TestSuiteName = ({
  className,
  children,
  ...props
}: TestSuiteNameProps) => {
  const { name, status } = useContext(TestSuiteContext);

  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        "group flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50",
        className,
      )}
      {...props}
    >
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
      <StatusGlyph status={status} />
      <span className="font-medium text-[13px]">{children ?? name}</span>
    </CollapsiblePrimitive.Trigger>
  );
};

export type TestSuiteStatsProps = HTMLAttributes<HTMLDivElement> & {
  passed?: number;
  failed?: number;
  skipped?: number;
};

export const TestSuiteStats = forwardRef<HTMLDivElement, TestSuiteStatsProps>(
  function TestSuiteStats(
    { passed = 0, failed = 0, skipped = 0, className, children, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn("ml-auto flex items-center gap-2 text-[12px]", className)}
        {...props}
      >
        {children ?? (
          <>
            {passed > 0 && (
              <span className="text-success">{passed} passed</span>
            )}
            {failed > 0 && (
              <span className="text-destructive">{failed} failed</span>
            )}
            {skipped > 0 && (
              <span className="text-warning">{skipped} skipped</span>
            )}
          </>
        )}
      </div>
    );
  },
);

export type TestSuiteContentProps = ComponentProps<
  typeof CollapsiblePrimitive.Content
>;

export const TestSuiteContent = ({
  className,
  children,
  ...props
}: TestSuiteContentProps) => (
  <CollapsiblePrimitive.Content
    className={cn("border-t border-border", className)}
    {...props}
  >
    <div className="divide-y divide-border">{children}</div>
  </CollapsiblePrimitive.Content>
);

// ─── Test (single test row) ─────────────────────────────────────────────────

interface TestContextValue {
  name: string;
  status: TestCaseStatus;
  duration: number | undefined;
}

const TestContext = createContext<TestContextValue>({
  name: "",
  status: "passed",
  duration: undefined,
});

export type TestProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  status: TestCaseStatus;
  duration?: number;
};

export const Test = forwardRef<HTMLDivElement, TestProps>(function Test(
  { name, status, duration, className, children, ...props },
  ref,
) {
  const ctx = useMemo(
    () => ({ duration, name, status }),
    [duration, name, status],
  );

  return (
    <TestContext.Provider value={ctx}>
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-[13px]",
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <TestStatus />
            <TestName />
            {duration !== undefined && <TestDuration />}
          </>
        )}
      </div>
    </TestContext.Provider>
  );
});

export type TestNameProps = HTMLAttributes<HTMLSpanElement>;

export const TestName = forwardRef<HTMLSpanElement, TestNameProps>(
  function TestName({ className, children, ...props }, ref) {
    const { name } = useContext(TestContext);
    return (
      <span ref={ref} className={cn("flex-1", className)} {...props}>
        {children ?? name}
      </span>
    );
  },
);

export type TestDurationProps = HTMLAttributes<HTMLSpanElement>;

export const TestDuration = forwardRef<HTMLSpanElement, TestDurationProps>(
  function TestDuration({ className, children, ...props }, ref) {
    const { duration } = useContext(TestContext);
    if (duration === undefined) return null;
    return (
      <span
        ref={ref}
        className={cn("ml-auto text-[12px] text-muted-foreground", className)}
        {...props}
      >
        {children ?? `${duration}ms`}
      </span>
    );
  },
);

export type TestStatusProps = HTMLAttributes<HTMLSpanElement>;

export const TestStatus = forwardRef<HTMLSpanElement, TestStatusProps>(
  function TestStatus({ className, children, ...props }, ref) {
    const { status } = useContext(TestContext);
    return (
      <span
        ref={ref}
        className={cn("shrink-0", statusTextClass[status], className)}
        {...props}
      >
        {children ?? statusIcons[status]}
      </span>
    );
  },
);

// ─── TestError ──────────────────────────────────────────────────────────────

export type TestErrorProps = HTMLAttributes<HTMLDivElement>;

export const TestError = forwardRef<HTMLDivElement, TestErrorProps>(
  function TestError({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

export type TestErrorMessageProps = HTMLAttributes<HTMLParagraphElement>;

export const TestErrorMessage = forwardRef<
  HTMLParagraphElement,
  TestErrorMessageProps
>(function TestErrorMessage({ className, children, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("font-medium text-[13px] text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  );
});

export type TestErrorStackProps = HTMLAttributes<HTMLPreElement>;

export const TestErrorStack = forwardRef<HTMLPreElement, TestErrorStackProps>(
  function TestErrorStack({ className, children, ...props }, ref) {
    return (
      <pre
        ref={ref}
        className={cn(
          "mt-2 overflow-auto font-mono text-[12px] text-destructive/80",
          className,
        )}
        {...props}
      >
        {children}
      </pre>
    );
  },
);
