import { Icon } from "./icon";
import type { FlatRoute } from "../routes";
import type { Shape, Theme } from "../hooks/use-tweaks";

interface TopbarProps {
  current: FlatRoute;
  theme: Theme;
  onToggleTheme: () => void;
  shape: Shape;
  onCycleShape: () => void;
  onOpenCmd: () => void;
}

export function Topbar({
  current,
  theme,
  onToggleTheme,
  shape,
  onCycleShape,
  onOpenCmd,
}: TopbarProps): React.JSX.Element {
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
        <TopbarIconButton
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"}`}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={13} />
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
