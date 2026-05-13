// @weekend/design/registry — production-grade Tailwind + Radix + framer-motion components.
// Consumers (e.g. apps/docs) need Tailwind v4 configured with @source pointing
// at this package's src directory.

// Foundations: shape + icon context, springs, proximity-hover hook.
export {
  ShapeProvider,
  useShape,
  useShapeContext,
  shapeMap,
  transitionShape,
} from "./lib/shape-context";
export type { ShapeVariant, ShapeMode, ShapeClasses } from "./lib/shape-context";

export {
  IconProvider,
  useIcon,
  useIcons,
  useIconLibrary,
  iconLibraryOrder,
  iconLibraryLabels,
  registerIconLibrary,
} from "./lib/icon-context";
export type {
  IconComponent,
  IconComponentProps,
  IconLibrary,
  IconName,
  AnyIconName,
} from "./lib/icon-context";

export { springs } from "./lib/springs";
export type { SpringName } from "./lib/springs";

export {
  useProximityHover,
  useRegisterProximityItem,
} from "./hooks/use-proximity-hover";
export type {
  ItemRect,
  ProximityHandlers,
  ProximityHoverApi,
  ProximityRect,
  UseProximityHoverReturn,
} from "./hooks/use-proximity-hover";

export {
  Accordion,
  AccordionContent,
  AccordionGroup,
  AccordionItem,
  AccordionTrigger,
} from "./registry/accordion";

export { Badge, BADGE_HEX, badgeColors, badgeVariants } from "./registry/badge";
export type { BadgeColor, BadgeProps, BadgeSize, BadgeVariant } from "./registry/badge";

export { CheckboxGroup, CheckboxItem } from "./registry/checkbox-group";
export type {
  CheckboxGroupProps,
  CheckboxItemProps,
} from "./registry/checkbox-group";

export {
  ColorPicker,
  ColorPickerPopover,
  ColorPickerPortalContainer,
  ColorSwatch,
  ColorTile,
  parseColor,
  buildParsed,
} from "./registry/color-picker";
export type {
  ColorFormat,
  ColorPickerPopoverProps,
  ColorPickerProps,
  ColorSwatchProps,
  ColorTileProps,
  ParsedColor,
} from "./registry/color-picker";

export { Combobox } from "./registry/combobox";
export type { ComboboxItem, ComboboxProps } from "./registry/combobox";

export { DiffAnchors } from "./registry/diff-anchors";
export type {
  DiffAnchor,
  DiffAnchorStatus,
  DiffAnchorsProps,
} from "./registry/diff-anchors";

export { DiffStack } from "./registry/diff-stack";
export type {
  DiffStackHandle,
  DiffStackItem,
  DiffStackProps,
} from "./registry/diff-stack";

export { SplitDiffViewer, diffsThemedTokens } from "./registry/split-diff-viewer";
export type {
  DiffsThemeType,
  SplitDiffViewerProps,
} from "./registry/split-diff-viewer";

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

export {
  Dropdown,
  DropdownLabel,
  DropdownSeparator,
  useDropdown,
} from "./registry/dropdown";
export type { DropdownProps } from "./registry/dropdown";

export { MenuItem } from "./registry/menu-item";
export type { MenuItemProps } from "./registry/menu-item";

export { InputCopy } from "./registry/input-copy";
export type { InputCopyProps } from "./registry/input-copy";

export { InputField, InputGroup } from "./registry/input-group";
export type { InputFieldProps, InputGroupProps } from "./registry/input-group";

export { NavItem } from "./registry/nav-item";
export type { NavItemProps } from "./registry/nav-item";

export { NavMenu, useNavMenu } from "./registry/nav-menu";
export type { NavMenuProps } from "./registry/nav-menu";

export { RadioGroup, RadioItem } from "./registry/radio-group";
export type { RadioGroupProps, RadioItemProps } from "./registry/radio-group";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  triggerVariants,
} from "./registry/select";
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

export {
  Tabs,
  TabsList,
  TabItem,
  TabPanel,
  // Back-compat aliases — prefer TabItem / TabPanel.
  TabsTrigger,
  TabsContent,
} from "./registry/tabs";
export type {
  TabsProps,
  TabsListProps,
  TabItemProps,
  TabPanelProps,
  TabsTriggerProps,
} from "./registry/tabs";

export { ToolCall } from "./registry/tool-call";
export type { ToolCallProps, ToolCallState } from "./registry/tool-call";

export { ToolCallList } from "./registry/tool-call-list";
export type {
  ToolCallListItem,
  ToolCallListProps,
} from "./registry/tool-call-list";

export { ChatMessage } from "./registry/chat-message";
export type {
  ChatMessageProps,
  ChatMessageRole,
} from "./registry/chat-message";

export { ChatMessageList } from "./registry/chat-message-list";
export type {
  ChatMessageListHandle,
  ChatMessageListProps,
} from "./registry/chat-message-list";

export { ChatComposer } from "./registry/chat-composer";
export type { ChatComposerProps } from "./registry/chat-composer";

export { ChatThinkingIndicator } from "./registry/chat-thinking-indicator";
export type { ChatThinkingIndicatorProps } from "./registry/chat-thinking-indicator";

export { ChatProgressBar } from "./registry/chat-progress-bar";
export type { ChatProgressBarProps } from "./registry/chat-progress-bar";

export { Chat, defaultMarkdownRenderer } from "./registry/chat";
export type {
  ChatMessageItem,
  ChatProps,
  ChatRenderMarkdown,
  ChatRenderMarkdownOptions,
  ChatStatus,
} from "./registry/chat";

// Re-export Streamdown so consumers can use it directly when constructing a
// custom <Chat renderMarkdown> or rendering Markdown elsewhere. Side-effect
// CSS import (`streamdown/styles.css`) is bundled into chat.tsx already.
export { Streamdown } from "streamdown";

export {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingStepImage,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from "./registry/thinking-steps";
export type {
  StepStatus,
  ThinkingStepDetailsProps,
  ThinkingStepImageProps,
  ThinkingStepProps,
  ThinkingStepSourceProps,
  ThinkingStepSourcesProps,
  ThinkingStepsContentProps,
  ThinkingStepsHeaderProps,
  ThinkingStepsProps,
} from "./registry/thinking-steps";

export { Tooltip, TooltipPortalContainer } from "./registry/tooltip";
export type { TooltipProps, TooltipSide } from "./registry/tooltip";

export {
  Test,
  TestDuration,
  TestError,
  TestErrorMessage,
  TestErrorStack,
  TestName,
  TestResults,
  TestResultsContent,
  TestResultsDuration,
  TestResultsHeader,
  TestResultsProgress,
  TestResultsSummary,
  TestStatus,
  TestSuite,
  TestSuiteContent,
  TestSuiteName,
  TestSuiteStats,
} from "./registry/test-results";
export type {
  TestCaseStatus,
  TestDurationProps,
  TestErrorMessageProps,
  TestErrorProps,
  TestErrorStackProps,
  TestNameProps,
  TestProps,
  TestResultsContentProps,
  TestResultsDurationProps,
  TestResultsHeaderProps,
  TestResultsProgressProps,
  TestResultsProps,
  TestResultsSummaryProps,
  TestRunSummary,
  TestStatusProps,
  TestSuiteContentProps,
  TestSuiteNameProps,
  TestSuiteProps,
  TestSuiteStatsProps,
} from "./registry/test-results";

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
