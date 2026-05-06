import type { ComponentType } from "react";
import { PageAccordion } from "./pages/accordion";
import { PageBadge } from "./pages/badge";
import { PageButton } from "./pages/button";
import { PageChangelog } from "./pages/changelog";
import { PageCheckboxRadio } from "./pages/checkbox-radio";
import { PageColorPicker } from "./pages/color-picker";
import { PageColors } from "./pages/colors";
import { PageDialog } from "./pages/dialog";
import { PageDropdown } from "./pages/dropdown";
import { PageIcons } from "./pages/icons";
import { PageInput } from "./pages/input";
import { PageInputCopy } from "./pages/input-copy";
import { PageInputGroup } from "./pages/input-group";
import { PageInstallation } from "./pages/installation";
import { PageIntroduction } from "./pages/introduction";
import { PageMobileDrawer } from "./pages/mobile-drawer";
import { PageMotion } from "./pages/motion";
import { PageNavMenu } from "./pages/nav-menu";
import { PageRadii } from "./pages/radii";
import { PageSelect } from "./pages/select";
import { PageShadows } from "./pages/shadows";
import { PageSidebar } from "./pages/sidebar";
import { PageSlider } from "./pages/slider";
import { PageSpacing } from "./pages/spacing";
import { PageSwitch } from "./pages/switch";
import { PageTable } from "./pages/table";
import { PageTabs } from "./pages/tabs";
import { PageThinking } from "./pages/thinking";
import { PageThinkingSteps } from "./pages/thinking-steps";
import { PageTooltip } from "./pages/tooltip";
import { PageTypography } from "./pages/typography";
import { PageVoice } from "./pages/voice";

/** Maps route ids to their page component. Routes without an entry fall back to the placeholder. */
export const PAGE_REGISTRY: Record<string, ComponentType> = {
  // Getting started
  introduction: PageIntroduction,
  installation: PageInstallation,
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
  "checkbox-radio": PageCheckboxRadio,
  "color-picker": PageColorPicker,
  dialog: PageDialog,
  dropdown: PageDropdown,
  input: PageInput,
  "input-copy": PageInputCopy,
  "input-group": PageInputGroup,
  "mobile-drawer": PageMobileDrawer,
  "nav-menu": PageNavMenu,
  select: PageSelect,
  sidebar: PageSidebar,
  slider: PageSlider,
  switch: PageSwitch,
  table: PageTable,
  tabs: PageTabs,
  thinking: PageThinking,
  "thinking-steps": PageThinkingSteps,
  tooltip: PageTooltip,
  // Reference
  icons: PageIcons,
  voice: PageVoice,
  changelog: PageChangelog,
};
