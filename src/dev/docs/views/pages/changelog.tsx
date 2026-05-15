import { H } from "../../components/heading";

interface Release {
  readonly version: string;
  readonly date: string;
  readonly notes: ReadonlyArray<string>;
  readonly tag?: "added" | "changed" | "fixed";
}

const RELEASES: ReadonlyArray<Release> = [
  {
    version: "v0.4.2",
    date: "2026-05-04",
    notes: [
      "Added Tooltip primitive (Radix-based, DS surface colors).",
      "Added ColorPicker (17-swatch grid).",
      "Migrated all registry components to TypeScript with strict types.",
    ],
  },
  {
    version: "v0.4.1",
    date: "2026-04-22",
    notes: [
      "Added Accordion, Select, NavMenu, NavItem, InputGroup, MobileDrawer.",
      "Tailwind v4 + framer-motion stack proven across all registry components.",
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-04-10",
    notes: [
      "First Tailwind/Radix/framer-motion port, Dialog, Table, MobileDrawer.",
      "Workspace migrated from CDN-React + Babel-standalone to Vite + TypeScript.",
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-03-15",
    notes: [
      "DS plain-CSS primitives stabilized: Button, IconButton, Switch, Slider, Seg, NumberStepper, Select.",
      "Vegas trainer demo migrated to TypeScript.",
    ],
  },
];

export function PageChangelog(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Reference</div>
        <h1>Changelog</h1>
        <p className="lede">Release notes for the design system. Most recent first.</p>
      </header>

      <div className="section">
        {RELEASES.map((r) => (
          <div key={r.version} style={{ marginBottom: 32 }}>
            <H as="h2" id={r.version}>
              <span style={{ fontFamily: "var(--font-mono)" }}>{r.version}</span>{" "}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  fontVariationSettings: "var(--fw-normal)",
                  marginLeft: 8,
                }}
              >
                {r.date}
              </span>
            </H>
            <ul
              style={{
                marginTop: 12,
                paddingLeft: 20,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {r.notes.map((note) => (
                <li key={`${r.version}-${note}`} style={{ fontSize: 14, lineHeight: 1.6 }}>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
