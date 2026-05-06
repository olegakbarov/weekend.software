import { Icon } from "./icon";
import type { FlatRoute } from "../routes";
import type { Shape } from "../hooks/use-tweaks";

interface TopbarProps {
  current: FlatRoute;
  theme: string;
  onCycleTheme: () => void;
  shape: Shape;
  onCycleShape: () => void;
  onOpenCmd: () => void;
}

const DARK_THEMES = new Set(["fluid-dark", "weekend-dark"]);

export function Topbar({
  current,
  theme,
  onCycleTheme,
  shape,
  onCycleShape,
  onOpenCmd,
}: TopbarProps): React.JSX.Element {
  const isDark = DARK_THEMES.has(theme);
  return (
    <div className="topbar">
      <div className="crumbs">
        <span>{current.group}</span>
        <span className="sep">/</span>
        <span className="leaf">{current.name}</span>
      </div>
      <div className="actions">
        <TopbarIconButton onClick={onOpenCmd} title="Search (⌘K)">
          <Icon name="search" size={13} />
        </TopbarIconButton>
        <TopbarIconButton onClick={onCycleShape} title={`Cycle shape (${shape})`}>
          <Icon name={shape === "pill" ? "circle" : "square"} size={13} />
        </TopbarIconButton>
        <TopbarIconButton onClick={onCycleTheme} title={`Cycle theme (${theme})`}>
          <Icon name={isDark ? "sun" : "moon"} size={13} />
        </TopbarIconButton>
        <a
          className="topbar-icon-link"
          href="https://github.com/mickadesign/fluid-functionalism"
          target="_blank"
          rel="noreferrer"
          title="GitHub"
        >
          <Icon name="github" size={13} />
        </a>
      </div>
    </div>
  );
}

function TopbarIconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="topbar-icon-btn"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
