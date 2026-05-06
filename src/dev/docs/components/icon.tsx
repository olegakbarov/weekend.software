import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Edit,
  Github,
  Grid3x3,
  Hash,
  Layers,
  Layout,
  List,
  type LucideProps,
  MessageCircle,
  MessageSquare,
  Moon,
  Package,
  Palette,
  PanelLeft,
  Search,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Table,
  ToggleRight,
  Type,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";

export type IconName =
  | "book"
  | "package"
  | "palette"
  | "type"
  | "sliders"
  | "circle"
  | "zap"
  | "layers"
  | "list"
  | "hash"
  | "square"
  | "check"
  | "layout"
  | "chevronDown"
  | "edit"
  | "copy"
  | "panelLeft"
  | "toggleR"
  | "table"
  | "sparkles"
  | "message"
  | "grid"
  | "feedback"
  | "search"
  | "sun"
  | "moon"
  | "github"
  | "chevronLeft"
  | "chevronRight";

const REGISTRY: Record<IconName, ComponentType<LucideProps>> = {
  book: BookOpen,
  package: Package,
  palette: Palette,
  type: Type,
  sliders: Sliders,
  circle: Circle,
  zap: Zap,
  layers: Layers,
  list: List,
  hash: Hash,
  square: Square,
  check: Check,
  layout: Layout,
  chevronDown: ChevronDown,
  edit: Edit,
  copy: Copy,
  panelLeft: PanelLeft,
  toggleR: ToggleRight,
  table: Table,
  sparkles: Sparkles,
  message: MessageCircle,
  grid: Grid3x3,
  feedback: MessageSquare,
  search: Search,
  sun: Sun,
  moon: Moon,
  github: Github,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
};

export interface IconProps extends Omit<LucideProps, "ref"> {
  name: IconName;
}

export function Icon({ name, size = 14, ...props }: IconProps): React.JSX.Element {
  const Component = REGISTRY[name];
  return <Component size={size} {...props} />;
}
