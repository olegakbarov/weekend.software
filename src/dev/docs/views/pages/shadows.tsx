interface ShadowSpec {
  readonly name: string;
  readonly val: string;
  readonly role: string;
}

const SHADOWS: ReadonlyArray<ShadowSpec> = [
  {
    name: "--shadow-card",
    val: "0 1px 2px rgba(0,0,0,0.04)",
    role: "Cards at rest",
  },
  {
    name: "--shadow-card-hover",
    val: "0 1px 2px rgba(0,0,0,0.08)",
    role: "Cards on hover",
  },
  {
    name: "--shadow-popover",
    val: "0 8px 24px -4px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
    role: "Dropdowns, tooltips",
  },
  {
    name: "--shadow-modal",
    val: "0 24px 64px -12px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
    role: "Modals, dialogs",
  },
];

export function PageShadows(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Tokens</div>
        <h1>Shadows</h1>
        <p className="lede">
          Almost flat. Cards get a 1px / 4% offset; on hover, that doubles to 8%. Popovers and
          modals add a second, larger shadow for offset elevation, but never anything dramatic.
        </p>
      </header>

      <div className="section">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 24,
            marginTop: 16,
          }}
        >
          {SHADOWS.map((s) => (
            <div
              key={s.name}
              style={{
                padding: 32,
                background: "var(--background)",
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  boxShadow: `var(${s.name})`,
                }}
              />
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontVariationSettings: "var(--fw-semibold)",
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    marginTop: 4,
                  }}
                >
                  {s.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
