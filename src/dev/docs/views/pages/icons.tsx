import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Bookmark,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  Filter,
  Folder,
  Github,
  Globe,
  Grid3x3,
  Hash,
  Heart,
  Home,
  Image as ImageIcon,
  Info,
  Layers,
  Layout,
  Link as LinkIcon,
  List,
  Lock,
  type LucideIcon,
  Mail,
  MessageCircle,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Package,
  Palette,
  PanelLeft,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Share,
  Sliders,
  Sparkles,
  Square,
  Star,
  Sun,
  Table,
  Tag,
  ToggleRight,
  Trash,
  Type,
  Upload,
  User,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

const ICONS: ReadonlyArray<readonly [string, LucideIcon]> = [
  ["AlertTriangle", AlertTriangle],
  ["Archive", Archive],
  ["ArrowDown", ArrowDown],
  ["ArrowLeft", ArrowLeft],
  ["ArrowRight", ArrowRight],
  ["ArrowUp", ArrowUp],
  ["Bell", Bell],
  ["Bookmark", Bookmark],
  ["BookOpen", BookOpen],
  ["Calendar", Calendar],
  ["Camera", Camera],
  ["Check", Check],
  ["ChevronDown", ChevronDown],
  ["ChevronLeft", ChevronLeft],
  ["ChevronRight", ChevronRight],
  ["ChevronUp", ChevronUp],
  ["Circle", Circle],
  ["Clock", Clock],
  ["Copy", Copy],
  ["Download", Download],
  ["Edit", Edit],
  ["ExternalLink", ExternalLink],
  ["Eye", Eye],
  ["EyeOff", EyeOff],
  ["File", File],
  ["Filter", Filter],
  ["Folder", Folder],
  ["Github", Github],
  ["Globe", Globe],
  ["Grid3x3", Grid3x3],
  ["Hash", Hash],
  ["Heart", Heart],
  ["Home", Home],
  ["Image", ImageIcon],
  ["Info", Info],
  ["Layers", Layers],
  ["Layout", Layout],
  ["Link", LinkIcon],
  ["List", List],
  ["Lock", Lock],
  ["Mail", Mail],
  ["MessageCircle", MessageCircle],
  ["MessageSquare", MessageSquare],
  ["Monitor", Monitor],
  ["Moon", Moon],
  ["MoreHorizontal", MoreHorizontal],
  ["Package", Package],
  ["Palette", Palette],
  ["PanelLeft", PanelLeft],
  ["Pause", Pause],
  ["Phone", Phone],
  ["Play", Play],
  ["Plus", Plus],
  ["RefreshCw", RefreshCw],
  ["Save", Save],
  ["Search", Search],
  ["Send", Send],
  ["Settings", Settings],
  ["Share", Share],
  ["Sliders", Sliders],
  ["Sparkles", Sparkles],
  ["Square", Square],
  ["Star", Star],
  ["Sun", Sun],
  ["Table", Table],
  ["Tag", Tag],
  ["ToggleRight", ToggleRight],
  ["Trash", Trash],
  ["Type", Type],
  ["Upload", Upload],
  ["User", User],
  ["Users", Users],
  ["Video", Video],
  ["X", X],
  ["Zap", Zap],
];

export function PageIcons(): React.JSX.Element {
  const [filter, setFilter] = useState("");

  const matched = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return ICONS;
    return ICONS.filter(([name]) => name.toLowerCase().includes(q));
  }, [filter]);

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Reference</div>
        <h1>Iconography</h1>
        <p className="lede">
          We use{" "}
          <a
            href="https://lucide.dev"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
          >
            Lucide
          </a>{" "}
          for icons. Stroke-width 1.5 at rest, 2 on hover. Default size is 14–16px. Below is the
          curated set used throughout the system; the full Lucide catalog (1,000+) is also
          available.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="library">
          Curated set ({ICONS.length})
        </H>
        <input
          className="input"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 360, marginBottom: 16 }}
        />
        <div className="icon-grid">
          {matched.map(([name, Icon]) => (
            <div key={name} className="icon-card">
              <Icon size={20} strokeWidth={1.5} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { Heart, Search, Settings } from "lucide-react";

<Heart size={14} strokeWidth={1.5} />`}</CodeBlock>
      </div>
    </>
  );
}
