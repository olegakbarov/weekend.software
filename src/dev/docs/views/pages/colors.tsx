import { BADGE_HEX } from "../../components/badge";
import { Callout } from "../../components/callout";
import { CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

const SURFACES: ReadonlyArray<readonly [string, string, string]> = [
  ["--background", "#FAFAFA", "Page"],
  ["--card", "#FFFFFF", "Raised"],
  ["--muted", "#F5F5F5", "Recessed"],
  ["--accent", "#E5E5E5", "Selection"],
  ["--foreground", "#171717", "Text"],
  ["--muted-foreground", "#737373", "Subtle text"],
];

const RAMP: ReadonlyArray<readonly [string, string, string]> = [
  ["50", "#FAFAFA", "#171717"],
  ["100", "#F5F5F5", "#171717"],
  ["200", "#E5E5E5", "#171717"],
  ["300", "#D4D4D4", "#171717"],
  ["400", "#A3A3A3", "#171717"],
  ["500", "#737373", "#FAFAFA"],
  ["600", "#525252", "#FAFAFA"],
  ["700", "#404040", "#FAFAFA"],
  ["800", "#262626", "#FAFAFA"],
  ["900", "#171717", "#FAFAFA"],
  ["950", "#0A0A0A", "#FAFAFA"],
];

const SEMANTIC: ReadonlyArray<readonly [string, string, string]> = [
  ["Destructive", "var(--destructive)", "#EF4444"],
  ["Destructive bg", "var(--destructive-light)", "#FEF2F2"],
  ["Focus ring", "var(--focus-ring)", "#6B97FF"],
  ["Border", "var(--border)", "#E5E5E5"],
];

export function PageColors(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Tokens</div>
        <h1>Colors</h1>
        <p className="lede">
          Three surfaces, one neutral ramp, and a 17-color accent palette. Light is default; dark
          is a peer. No gradients in chrome.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="surfaces">
          Surfaces
        </H>
        <p>
          Three depth levels, that's it. Hover and active are surface-relative overlays — they
          work on any elevation.
        </p>
        <div className="swatch-grid" style={{ marginTop: 16 }}>
          {SURFACES.map(([name, hex, role]) => (
            <div key={name} className="swatch">
              <div className="chip" style={{ background: `var(${name})` }} />
              <div className="meta">
                <div className="name">{role}</div>
                <div className="val">{name}</div>
                <div className="val" style={{ opacity: 0.6 }}>
                  {hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="neutrals">
          Neutral ramp
        </H>
        <p>
          Tailwind's neutral scale, mapped to <CodeInline>--neutral-50</CodeInline> through{" "}
          <CodeInline>--neutral-950</CodeInline>. The ramp does not invert in dark mode — only the
          surface tokens do.
        </p>
        <div className="ramp" style={{ marginTop: 16 }}>
          {RAMP.map(([k, hex, fg]) => (
            <div key={k} className="step" style={{ background: hex, color: fg }}>
              <span style={{ opacity: 0.7 }}>{k}</span>
              <span>{hex}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="accent">
          Accent palette
        </H>
        <p>
          17 Tailwind 500s. Used for <strong>Badge variants</strong> and the{" "}
          <strong>ColorPicker</strong> — never for primary chrome. When applied as a Badge
          background, the color is mixed with the card surface at 15% opacity.
        </p>
        <div className="swatch-grid" style={{ marginTop: 16 }}>
          {Object.entries(BADGE_HEX).map(([name, hex]) => (
            <div key={name} className="swatch">
              <div className="chip" style={{ background: hex }} />
              <div className="meta">
                <div className="name">{name}</div>
                <div className="val">{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="semantic">
          Semantic & focus
        </H>
        <div className="swatch-grid" style={{ marginTop: 16 }}>
          {SEMANTIC.map(([role, css, hex]) => (
            <div key={role} className="swatch">
              <div className="chip" style={{ background: css }} />
              <div className="meta">
                <div className="name">{role}</div>
                <div className="val">{hex}</div>
              </div>
            </div>
          ))}
        </div>
        <Callout>
          <strong>The focus ring is the only chromatic accent in the system.</strong> A 1px
          outline on <CodeInline>:focus-visible</CodeInline> only — never on click. Mouse users
          never see it; keyboard users always do.
        </Callout>
      </div>
    </>
  );
}
