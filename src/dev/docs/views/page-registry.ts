import type { ComponentType } from "react";
import { PageAccordion } from "./pages/accordion";
import { PageAudit } from "./pages/audit";
import { PageBadge } from "./pages/badge";
import { PageButton } from "./pages/button";
import { PageChat } from "./pages/chat";
import { PageChangelog } from "./pages/changelog";
import { PageCheckboxRadio } from "./pages/checkbox-radio";
import { PageColorPicker } from "./pages/color-picker";
import { PageColors } from "./pages/colors";
import { PageCombobox } from "./pages/combobox";
import { PageConsumers } from "./pages/consumers";
import { PageDialog } from "./pages/dialog";
import { PageDropdown } from "./pages/dropdown";
import { PageFileTree } from "./pages/file-tree";
import { PageIcons } from "./pages/icons";
import { PageInput } from "./pages/input";
import { PageInputCopy } from "./pages/input-copy";
import { PageInputGroup } from "./pages/input-group";
import { PageMotion } from "./pages/motion";
import { PageNavMenu } from "./pages/nav-menu";
import { PageRadii } from "./pages/radii";
import { PageSelect } from "./pages/select";
import { PageShadows } from "./pages/shadows";
import { PageSidebar } from "./pages/sidebar";
import { PageSlider } from "./pages/slider";
import { PageSpacing } from "./pages/spacing";
import { PageStatus } from "./pages/status";
import { PageSwitch } from "./pages/switch";
import { PageTable } from "./pages/table";
import { PageTabs } from "./pages/tabs";
import { PageTestResults } from "./pages/test-results";
import { PageThinking } from "./pages/thinking";
import { PageThinkingSteps } from "./pages/thinking-steps";
import { PageToolCall } from "./pages/tool-call";
import { PageTooltip } from "./pages/tooltip";
import { PageTypography } from "./pages/typography";
import { PageVoice } from "./pages/voice";
import { PageWorkbench } from "./pages/workbench";

/** Maps route ids to their page component. Routes without an entry fall back to the placeholder. */
export const PAGE_REGISTRY: Record<string, ComponentType> = {
  // State
  workbench: PageWorkbench,
  status: PageStatus,
  audit: PageAudit,
  consumers: PageConsumers,
  // Tokens
  colors: PageColors,
  typography: PageTypography,
  spacing: PageSpacing,
  radii: PageRadii,
  motion: PageMotion,
  shadows: PageShadows,
  // Components
  accordion: PageAccordion,
  badge: PageBadge,
  button: PageButton,
  chat: PageChat,
  "checkbox-radio": PageCheckboxRadio,
  "color-picker": PageColorPicker,
  combobox: PageCombobox,
  dialog: PageDialog,
  dropdown: PageDropdown,
  "file-tree": PageFileTree,
  input: PageInput,
  "input-copy": PageInputCopy,
  "input-group": PageInputGroup,
  "nav-menu": PageNavMenu,
  select: PageSelect,
  sidebar: PageSidebar,
  slider: PageSlider,
  switch: PageSwitch,
  table: PageTable,
  tabs: PageTabs,
  "test-results": PageTestResults,
  thinking: PageThinking,
  "thinking-steps": PageThinkingSteps,
  "tool-call": PageToolCall,
  tooltip: PageTooltip,
  // Reference
  icons: PageIcons,
  voice: PageVoice,
  changelog: PageChangelog,
};
