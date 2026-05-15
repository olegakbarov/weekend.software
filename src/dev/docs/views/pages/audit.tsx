import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeColor,
} from "@weekend/design/registry";
import { CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

/**
 * Snapshot of `packages/design/AUDIT/INVENTORY.md`, Wave 1 fidelity table,
 * post-Phase-D. Hardcoded since the markdown's structure is stable; bump
 * during the next migration wave when the audit moves.
 */
type FidelityStatus =
  | "identical"
  | "identical-extended"
  | "weekend-only"
  | "third-party"
  | "deferred"
  | "missing";

interface AuditRow {
  readonly component: string;
  readonly path: string;
  readonly status: FidelityStatus;
  readonly note: string;
}

const STATUS_LABEL: Record<FidelityStatus, string> = {
  identical: "Identical",
  "identical-extended": "Identical + extension",
  "weekend-only": "Weekend-only",
  "third-party": "3p adapter",
  deferred: "Deferred",
  missing: "Missing",
};

const STATUS_COLOR: Record<FidelityStatus, BadgeColor> = {
  identical: "green",
  "identical-extended": "teal",
  "weekend-only": "blue",
  "third-party": "violet",
  deferred: "amber",
  missing: "red",
};

const ROWS: ReadonlyArray<AuditRow> = [
  {
    component: "Accordion",
    path: "src/registry/accordion.tsx",
    status: "identical",
    note: "Full AccordionGroup proximity-hover overlay restored (post-B1).",
  },
  {
    component: "Badge",
    path: "src/registry/badge.tsx",
    status: "identical",
    note: "forwardRef + HTML-attrs spread; restored upstream sizes (post-B8).",
  },
  {
    component: "Button",
    path: "src/components/button.tsx",
    status: "identical-extended",
    note: "4 upstream variants + 3 Weekend extras (destructive/success/link).",
  },
  {
    component: "CheckboxGroup + CheckboxItem",
    path: "src/registry/checkbox-group.tsx",
    status: "identical",
    note: "Form-input pair on Phase F infra; Radix swap deferred (post-D2).",
  },
  {
    component: "ColorPicker",
    path: "src/registry/color-picker.tsx",
    status: "identical",
    note: "Full HSV/HSL/OKLCH + eyedropper + scrubbable channels (post-C/D1).",
  },
  {
    component: "Dialog",
    path: "src/registry/dialog.tsx",
    status: "identical",
    note: "Close routed through Button variant=ghost (post-B9).",
  },
  {
    component: "Dropdown + MenuItem",
    path: "src/registry/dropdown.tsx",
    status: "identical",
    note: "Single-select menu surface with proximity-hover bg (post-D1).",
  },
  {
    component: "InputCopy",
    path: "src/registry/input-copy.tsx",
    status: "identical",
    note: "3-state tooltip machine + onPointerDown capture (post-B3).",
  },
  {
    component: "InputGroup / InputField",
    path: "src/registry/input-group.tsx",
    status: "identical",
    note: "Verbatim port pre-audit; only formatting differs.",
  },
  {
    component: "RadioGroup + RadioItem",
    path: "src/registry/radio-group.tsx",
    status: "identical",
    note: "Pair with CheckboxGroup; same Radix-deferred deviation (post-D2).",
  },
  {
    component: "Select (registry)",
    path: "src/registry/select.tsx",
    status: "identical",
    note: "312→769 LOC. Animated proximity-hover + checked-row + focus ring (post-B4).",
  },
  {
    component: "Select (Weekend skin)",
    path: "src/components/select.tsx",
    status: "weekend-only",
    note: "Thin Weekend-only wrapper for legacy desktop call sites.",
  },
  {
    component: "Slider",
    path: "src/components/slider.tsx",
    status: "identical",
    note: "73→1515 LOC + 515 CSS. Full Radix-backed port (post-B5).",
  },
  {
    component: "Switch",
    path: "src/components/switch.tsx",
    status: "identical-extended",
    note: "Drag-to-toggle + Weekend mono-blue ON-state via [data-theme] (post-B6/D1).",
  },
  {
    component: "Table",
    path: "src/registry/table.tsx",
    status: "identical",
    note: "Verbatim.",
  },
  {
    component: "Tabs",
    path: "src/registry/tabs.tsx",
    status: "weekend-only",
    note: "Thin Radix wrapper. Upstream Tabs is rich/animated; this stays simple.",
  },
  {
    component: "TabsSubtle",
    path: "None",
    status: "deferred",
    note: "Skipped per D2, Weekend Seg covers the segmented-control intent.",
  },
  {
    component: "ThinkingIndicator",
    path: "None",
    status: "deferred",
    note: "Skipped per D2. shimmer-text keyframes ready in tokens.",
  },
  {
    component: "ThinkingSteps",
    path: "src/registry/thinking-steps.tsx",
    status: "identical",
    note: "Active label gets shimmer-text class. New exports added (post-B8).",
  },
  {
    component: "Tooltip",
    path: "src/registry/tooltip.tsx",
    status: "identical",
    note: "Directional spring slide-in via framer-motion (post-B2).",
  },
  {
    component: "NavItem",
    path: "src/registry/nav-item.tsx",
    status: "identical",
    note: "Identical visuals; deliberate <a> vs next/link swap.",
  },
  {
    component: "NavMenu",
    path: "src/registry/nav-menu.tsx",
    status: "identical",
    note: "Identical text; foundation aligned in Phase F.",
  },
  {
    component: "Combobox",
    path: "src/registry/combobox.tsx",
    status: "weekend-only",
    note: "Combobox/select hybrid, no upstream equivalent.",
  },
  {
    component: "NumberStepper",
    path: "src/components/number-stepper.tsx",
    status: "weekend-only",
    note: "Numeric +/- stepper with hold-to-repeat, Weekend product surface.",
  },
  {
    component: "Seg",
    path: "src/components/seg.tsx",
    status: "weekend-only",
    note: "Weekend's segmented control. Overlaps tabs-subtle in intent.",
  },
  {
    component: "Textarea",
    path: "src/components/textarea.tsx",
    status: "weekend-only",
    note: "Upstream has no textarea primitive.",
  },
  {
    component: "FileTree",
    path: "@pierre/trees/react",
    status: "third-party",
    note: "Re-export of Pierre tree component. No fidelity audit possible.",
  },
];

const SUMMARY: ReadonlyArray<readonly [string, number, FidelityStatus]> = [
  ["Identical to upstream", 19, "identical"],
  ["Identical + Weekend extension", 2, "identical-extended"],
  ["Weekend-only, retained", 5, "weekend-only"],
  ["Third-party adapter", 1, "third-party"],
  ["Deferred", 2, "deferred"],
  ["Missing", 0, "missing"],
];

export function PageAudit(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">State</div>
        <h1>Audit</h1>
        <p className="lede">
          Per-artifact fidelity against the upstream{" "}
          <a
            href="https://github.com/mickadesign/fluid-functionalism"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
          >
            fluid-functionalism
          </a>{" "}
          repo. Source: <CodeInline>packages/design/AUDIT/INVENTORY.md</CodeInline>.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="summary">
          Summary
        </H>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          {SUMMARY.map(([label, count, status]) => (
            <div
              key={label}
              style={{
                padding: 14,
                border: "1px solid var(--border)",
                borderRadius: "var(--shape-container, 12px)",
                background: "var(--card)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <Badge color={STATUS_COLOR[status]} size="sm" variant="dot">
                {STATUS_LABEL[status]}
              </Badge>
              <div
                style={{
                  fontSize: 22,
                  fontVariationSettings: "var(--fw-semibold)",
                  letterSpacing: "-0.01em",
                }}
              >
                {count}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="components">
          Components
        </H>
        <p>
          {ROWS.length} entries. Status reflects the post-Phase-D snapshot, see{" "}
          <CodeInline>AUDIT/SUMMARY.md</CodeInline> for the per-commit migration record.
        </p>
        <div className="example">
          <div className="example-stage" style={{ padding: 0 }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((row, i) => (
                  <TableRow key={row.component} index={i}>
                    <TableCell>
                      <span style={{ fontVariationSettings: "var(--fw-semibold)" }}>
                        {row.component}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {row.path}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge color={STATUS_COLOR[row.status]} size="sm" variant="dot">
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                        {row.note}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
