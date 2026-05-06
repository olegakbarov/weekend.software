import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Play, Settings, Plus, X } from "lucide-react";
import { Button, IconButton, Slider, Switch } from "@weekend/design";
import {
  Badge,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Tooltip,
} from "@weekend/design/registry";

export const Route = createFileRoute("/dev/ds")({
  component: DesignSystemRoute,
});

type Theme = "weekend-dark" | "weekend-paper";

function readTheme(): Theme {
  if (typeof document === "undefined") return "weekend-dark";
  const t = document.documentElement.dataset.theme;
  return t === "weekend-paper" ? "weekend-paper" : "weekend-dark";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--muted-foreground)", letterSpacing: 0.4, textTransform: "uppercase" }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>{children}</div>
    </section>
  );
}

function DesignSystemRoute() {
  const [theme, setTheme] = useState<Theme>("weekend-dark");
  const [switchA, setSwitchA] = useState(false);
  const [switchB, setSwitchB] = useState(true);
  const [sliderValue, setSliderValue] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggleTheme = () => {
    if (typeof document === "undefined") return;
    const next: Theme = theme === "weekend-dark" ? "weekend-paper" : "weekend-dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  const badgeColors = ["gray", "red", "amber", "green", "blue", "violet", "pink"] as const;

  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100%",
        overflow: "auto",
      }}
    >
      <div style={{ maxWidth: 960, margin: "32px auto", padding: 24 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>Design System Parity</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
              Active theme: <code>{theme}</code>
            </p>
          </div>
          <Button variant="primary" onClick={toggleTheme}>
            Toggle theme
          </Button>
        </header>

        <Section title="Button">
          <Button variant="primary" onClick={() => console.log("primary")}>Primary</Button>
          <Button variant="tertiary" onClick={() => console.log("tertiary")}>Tertiary</Button>
          <Button variant="ghost" onClick={() => console.log("ghost")}>Ghost</Button>
          <Button size="sm" onClick={() => console.log("sm")}>Small</Button>
          <Button size="md" onClick={() => console.log("md")}>Medium</Button>
          <Button size="lg" onClick={() => console.log("lg")}>Large</Button>
          <Button variant="primary" icon={Play} onClick={() => console.log("with icon")}>
            Play
          </Button>
        </Section>

        <Section title="IconButton">
          <IconButton icon={Settings} label="Settings" onClick={() => console.log("settings")} />
          <IconButton icon={Plus} label="Add" onClick={() => console.log("add")} />
          <IconButton icon={X} label="Close" onClick={() => console.log("close")} />
        </Section>

        <Section title="Switch">
          <Switch checked={switchA} onChange={setSwitchA} ariaLabel="off switch" />
          <Switch checked={switchB} onChange={setSwitchB} ariaLabel="on switch" />
          <Switch checked={false} onChange={() => undefined} disabled ariaLabel="disabled switch" />
        </Section>

        <Section title="Slider">
          <div style={{ minWidth: 240 }}>
            <Slider min={0} max={100} value={sliderValue} onChange={setSliderValue} />
          </div>
        </Section>

        <Section title="Tooltip">
          <Tooltip content="A tooltip on a button">
            <Button variant="tertiary">Hover me</Button>
          </Tooltip>
        </Section>

        <Section title="Dialog">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="primary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sample dialog</DialogTitle>
                <DialogDescription>
                  This dialog is rendered from <code>@weekend/design/registry</code> for parity inspection.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="tertiary">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Badge">
          {badgeColors.map((color) => (
            <Badge key={color} color={color}>
              {color}
            </Badge>
          ))}
        </Section>
      </div>
    </div>
  );
}
