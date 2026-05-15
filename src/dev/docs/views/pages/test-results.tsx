import {
  Test,
  TestError,
  TestErrorMessage,
  TestErrorStack,
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
  type TestRunSummary,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const SAMPLE_SUMMARY: TestRunSummary = {
  passed: 42,
  failed: 2,
  skipped: 3,
  total: 47,
  duration: 4_217,
};

export function PageTestResults(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Test Results</h1>
        <p className="lede">
          Compositional primitives for rendering test-runner output. The root
          stitches a header, progress bar, and a list of collapsible suites
          containing pass/fail/skip rows. Status drives the icon and tint; the
          summary pills use Weekend Badge colors.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="default">
          Default header
        </H>
        <p>
          Pass <code>summary</code> with no children, the default renders the
          summary pills and total duration.
        </p>
        <div className="example">
          <div className="example-stage">
            <TestResults summary={SAMPLE_SUMMARY} />
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="composed">
          Composed
        </H>
        <p>
          For a richer view, opt into the slot API: header, progress bar, and a
          content list of suites.
        </p>
        <div className="example">
          <div className="example-stage">
            <TestResults summary={SAMPLE_SUMMARY}>
              <TestResultsHeader>
                <TestResultsSummary />
                <TestResultsDuration />
              </TestResultsHeader>
              <TestResultsContent>
                <TestResultsProgress />
                <TestSuite name="auth" status="passed" defaultOpen>
                  <TestSuiteName>
                    auth
                    <TestSuiteStats passed={3} />
                  </TestSuiteName>
                  <TestSuiteContent>
                    <Test
                      name="logs in with valid credentials"
                      status="passed"
                      duration={42}
                    />
                    <Test
                      name="rejects expired tokens"
                      status="passed"
                      duration={11}
                    />
                    <Test
                      name="rotates session on privilege change"
                      status="passed"
                      duration={87}
                    />
                  </TestSuiteContent>
                </TestSuite>
                <TestSuite name="api" status="failed" defaultOpen>
                  <TestSuiteName>
                    api
                    <TestSuiteStats passed={2} failed={2} />
                  </TestSuiteName>
                  <TestSuiteContent>
                    <Test name="GET /users" status="passed" duration={23} />
                    <Test name="GET /users/:id" status="passed" duration={18} />
                    <div className="px-4 py-2">
                      <Test
                        name="POST /users"
                        status="failed"
                        duration={104}
                      />
                      <TestError>
                        <TestErrorMessage>
                          Expected 201 but received 500
                        </TestErrorMessage>
                        <TestErrorStack>
                          {`AssertionError: expected 500 to equal 201
    at Context.<anonymous> (test/api/users.spec.ts:42:16)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`}
                        </TestErrorStack>
                      </TestError>
                    </div>
                    <Test
                      name="DELETE /users/:id"
                      status="failed"
                      duration={67}
                    />
                  </TestSuiteContent>
                </TestSuite>
                <TestSuite name="billing" status="skipped">
                  <TestSuiteName>
                    billing
                    <TestSuiteStats skipped={3} />
                  </TestSuiteName>
                  <TestSuiteContent>
                    <Test name="charges card" status="skipped" />
                    <Test name="refunds payment" status="skipped" />
                    <Test name="renews subscription" status="skipped" />
                  </TestSuiteContent>
                </TestSuite>
                <TestSuite name="search (in progress)" status="running">
                  <TestSuiteName>
                    search (in progress)
                    <TestSuiteStats passed={1} />
                  </TestSuiteName>
                  <TestSuiteContent>
                    <Test
                      name="indexes new documents"
                      status="passed"
                      duration={140}
                    />
                    <Test name="ranks by relevance" status="running" />
                  </TestSuiteContent>
                </TestSuite>
              </TestResultsContent>
            </TestResults>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<TestResults summary={{ passed: 42, failed: 2, skipped: 3, total: 47, duration: 4217 }}>
  <TestResultsHeader>
    <TestResultsSummary />
    <TestResultsDuration />
  </TestResultsHeader>
  <TestResultsContent>
    <TestResultsProgress />
    <TestSuite name="auth" status="passed" defaultOpen>
      <TestSuiteName>
        auth
        <TestSuiteStats passed={3} />
      </TestSuiteName>
      <TestSuiteContent>
        <Test name="logs in" status="passed" duration={42} />
      </TestSuiteContent>
    </TestSuite>
  </TestResultsContent>
</TestResults>`}</CodeBlock>
      </div>
    </>
  );
}
