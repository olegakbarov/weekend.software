import type { IconName } from "./components/icon";

export interface Route {
  readonly id: string;
  readonly name: string;
  readonly icon: IconName;
  readonly isNew?: boolean;
}

export interface RouteGroup {
  readonly group: string;
  readonly items: ReadonlyArray<Route>;
}

export const ROUTES: ReadonlyArray<RouteGroup> = [
  {
    group: "State",
    items: [
      { id: "workbench", name: "Workbench", icon: "sliders" },
      { id: "status", name: "Status", icon: "activity" },
      { id: "audit", name: "Audit", icon: "clipboardCheck" },
      { id: "consumers", name: "Consumers", icon: "users" },
    ],
  },
  {
    group: "Tokens",
    items: [
      { id: "colors", name: "Colors", icon: "palette" },
      { id: "typography", name: "Typography", icon: "type" },
      { id: "spacing", name: "Spacing", icon: "sliders" },
      { id: "radii", name: "Radii", icon: "circle" },
      { id: "motion", name: "Motion", icon: "zap" },
      { id: "shadows", name: "Shadows", icon: "layers" },
    ],
  },
  {
    group: "Components",
    items: [
      { id: "accordion", name: "Accordion", icon: "list" },
      { id: "chat", name: "Chat", icon: "message", isNew: true },
      { id: "badge", name: "Badge", icon: "hash" },
      { id: "button", name: "Button", icon: "square" },
      { id: "checkbox-radio", name: "Checkbox & Radio", icon: "check" },
      { id: "color-picker", name: "Color Picker", icon: "palette" },
      { id: "combobox", name: "Combobox", icon: "chevronDown" },
      { id: "diagram", name: "Diagram", icon: "grid", isNew: true },
      { id: "dialog", name: "Dialog", icon: "layout" },
      { id: "dropdown", name: "Dropdown", icon: "chevronDown" },
      { id: "file-tree", name: "File Tree", icon: "list" },
      { id: "input", name: "Input", icon: "edit" },
      { id: "input-copy", name: "Input Copy", icon: "copy" },
      { id: "input-group", name: "Input Group", icon: "edit" },
      { id: "nav-menu", name: "Nav Menu", icon: "list" },
      { id: "select", name: "Select", icon: "chevronDown" },
      { id: "sidebar", name: "Sidebar", icon: "panelLeft" },
      { id: "slider", name: "Slider", icon: "sliders" },
      { id: "switch", name: "Switch", icon: "toggleR" },
      { id: "table", name: "Table", icon: "table" },
      { id: "tabs", name: "Tabs", icon: "layout" },
      { id: "test-results", name: "Test Results", icon: "clipboardCheck", isNew: true },
      { id: "thinking", name: "Thinking indicator", icon: "sparkles" },
      { id: "thinking-steps", name: "Thinking Steps", icon: "sparkles" },
      { id: "tool-call", name: "Tool Call", icon: "sliders", isNew: true },
      { id: "tooltip", name: "Tooltip", icon: "message" },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "icons", name: "Iconography", icon: "grid" },
      { id: "voice", name: "Voice & copy", icon: "feedback" },
      { id: "changelog", name: "Changelog", icon: "list" },
    ],
  },
];

export interface FlatRoute extends Route {
  readonly group: string;
}

export const FLAT_ROUTES: ReadonlyArray<FlatRoute> = ROUTES.flatMap((g) =>
  g.items.map((it) => ({ ...it, group: g.group })),
);

export const DEFAULT_ROUTE = "workbench";

export function findRouteById(id: string): FlatRoute | undefined {
  return FLAT_ROUTES.find((r) => r.id === id);
}

/** Read the current route id from `location.hash`, defaulting to {@link DEFAULT_ROUTE}. */
export function getRouteFromHash(): string {
  const id = (location.hash || "").replace(/^#\/?/, "").split("/")[0] ?? "";
  return findRouteById(id) ? id : DEFAULT_ROUTE;
}
