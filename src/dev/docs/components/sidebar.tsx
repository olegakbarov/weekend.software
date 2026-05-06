import { Icon } from "./icon";
import { ROUTES } from "../routes";

interface SidebarProps {
  route: string;
  onNav: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCmd: () => void;
}

export function Sidebar({
  route,
  onNav,
  collapsed,
  onToggleCollapse,
  onOpenCmd,
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">F</div>
        <div className="name">Fluid Functionalism</div>
      </div>

      {!collapsed && (
        <button
          type="button"
          className="navsearch"
          onClick={onOpenCmd}
          style={{
            cursor: "pointer",
            background: "transparent",
            textAlign: "left",
            width: "100%",
          }}
        >
          <Icon name="search" size={12} />
          <input placeholder="Search components" readOnly style={{ cursor: "pointer" }} />
          <kbd>⌘K</kbd>
        </button>
      )}
      {collapsed && (
        <button
          type="button"
          className="sidebar-collapse-btn"
          style={{ alignSelf: "center", marginBottom: 8 }}
          onClick={onOpenCmd}
          title="Search ⌘K"
        >
          <Icon name="search" size={14} />
        </button>
      )}

      {ROUTES.map((g) => (
        <div key={g.group}>
          <div className="nav-section">{g.group}</div>
          <div className="nav">
            {g.items.map((it) => (
              <a
                key={it.id}
                href={`#/${it.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNav(it.id);
                }}
                data-active={route === it.id ? true : undefined}
                title={collapsed ? it.name : undefined}
              >
                <Icon name={it.icon} size={14} className="nav-icon" />
                <span>{it.name}</span>
                {it.isNew && <span className="badge-new">new</span>}
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className="sidebar-footer">
        {!collapsed && <span>v0.4.2</span>}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={12} />
        </button>
      </div>
    </aside>
  );
}
