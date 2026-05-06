// @weekend/design/registry — production-grade Tailwind + Radix + framer-motion components.
// Consumers (e.g. apps/docs) need Tailwind v4 configured with @source pointing
// at this package's src directory.

export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./registry/accordion";

export { Badge, BADGE_HEX } from "./registry/badge";
export type { BadgeColor, BadgeSize, BadgeVariant } from "./registry/badge";

export { ColorPicker } from "./registry/color-picker";
export type { ColorPickerProps } from "./registry/color-picker";

export { Combobox } from "./registry/combobox";
export type { ComboboxItem, ComboboxProps } from "./registry/combobox";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./registry/dialog";
export type { DialogContentProps } from "./registry/dialog";

export { InputCopy } from "./registry/input-copy";
export type { InputCopyProps } from "./registry/input-copy";

export { InputField, InputGroup } from "./registry/input-group";
export type { InputFieldProps, InputGroupProps } from "./registry/input-group";

export { MobileDrawer } from "./registry/mobile-drawer";

export { NavItem } from "./registry/nav-item";
export type { NavItemProps } from "./registry/nav-item";

export { NavMenu, useNavMenu } from "./registry/nav-menu";
export type { NavMenuProps } from "./registry/nav-menu";

export { Select, SelectContent, SelectItem, SelectTrigger } from "./registry/select";
export type {
  SelectContentProps,
  SelectItemProps,
  SelectProps,
  SelectTriggerProps,
} from "./registry/select";

export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./registry/table";
export type { TableProps, TableRowProps } from "./registry/table";

export { Tabs, TabsContent, TabsList, TabsTrigger } from "./registry/tabs";

export {
  ThinkingStep,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from "./registry/thinking-steps";
export type {
  StepStatus,
  ThinkingStepProps,
  ThinkingStepSourceProps,
  ThinkingStepSourcesProps,
  ThinkingStepsContentProps,
  ThinkingStepsHeaderProps,
  ThinkingStepsProps,
} from "./registry/thinking-steps";

export { Tooltip } from "./registry/tooltip";

// File tree primitive — React API from @pierre/trees.
// The `<FileTree>` component renders inside a shadow root, so no CSS import is
// required by consumers. `prepareFileTreeInput` and `preparePresortedFileTreeInput`
// live on the root entry of `@pierre/trees`; the React hooks/component live on
// the `/react` subpath.
export {
  FileTree,
  useFileTree,
  useFileTreeSearch,
  useFileTreeSelection,
  useFileTreeSelector,
} from "@pierre/trees/react";
export type {
  FileTreePreloadedData,
  FileTreeProps,
  FileTreeSearchState,
  FileTreeSelector,
  FileTreeSelectorEquality,
  UseFileTreeResult,
} from "@pierre/trees/react";
export { prepareFileTreeInput, preparePresortedFileTreeInput } from "@pierre/trees";
export type { FileTreePreparedInput } from "@pierre/trees";
