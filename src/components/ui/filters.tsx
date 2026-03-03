import { AnimatePresence, motion } from "framer-motion";
import { Check, Tag, X } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";

import {
  BacklogIcon,
  CompletedIcon,
  InProgressIcon,
  TechnicalReviewIcon,
  ToDoIcon,
} from "@/components/tasks/circle-status-icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TaskStatus } from "@/lib/types/task";
import { cn } from "@/lib/utils";

interface AnimateChangeInHeightProps {
  children: ReactNode;
  className?: string;
}

export const AnimateChangeInHeight = ({
  children,
  className,
}: AnimateChangeInHeightProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const resizeObserver = new ResizeObserver((entries) => {
      const observedHeight = entries[0]?.contentRect.height ?? 0;
      setHeight(observedHeight);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <motion.div
      animate={{ height }}
      className={cn(className, "overflow-hidden")}
      style={{ height }}
      transition={{ duration: 0.1, damping: 0.2, ease: "easeIn" }}
    >
      <div ref={containerRef}>{children}</div>
    </motion.div>
  );
};

export const FilterType = {
  STATUS: "Status",
  LABELS: "Labels",
} as const;

export type FilterType = (typeof FilterType)[keyof typeof FilterType];

export const FilterOperator = {
  IS: "is",
  IS_NOT: "is not",
  IS_ANY_OF: "is any of",
  INCLUDE: "include",
  DO_NOT_INCLUDE: "do not include",
  INCLUDE_ALL_OF: "include all of",
  INCLUDE_ANY_OF: "include any of",
  EXCLUDE_ALL_OF: "exclude all of",
  EXCLUDE_IF_ANY_OF: "exclude if any of",
} as const;

export type FilterOperator =
  (typeof FilterOperator)[keyof typeof FilterOperator];

export interface FilterOption {
  name: string;
  icon?: ReactNode;
  label?: string;
}

export interface Filter {
  id: string;
  type: FilterType;
  operator: FilterOperator;
  value: string[];
}

export type FilterOptionsByType = Partial<Record<FilterType, FilterOption[]>>;

// Status icon component using app's circle status icons
const StatusIcon = ({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) =>
  match(status)
    .with("planned", () => (
      <ToDoIcon
        className={cn("size-3.5", className)}
        style={{ color: "#e2e2e2" }}
      />
    ))
    .with("implemented", () => (
      <InProgressIcon
        className={cn("size-3.5", className)}
        style={{ color: "#facc15" }}
      />
    ))
    .with("verified", () => (
      <TechnicalReviewIcon
        className={cn("size-3.5", className)}
        style={{ color: "#22c55e" }}
      />
    ))
    .with("merging", () => (
      <CompletedIcon
        className={cn("size-3.5", className)}
        style={{ color: "#8b5cf6" }}
      />
    ))
    .otherwise(() => (
      <BacklogIcon
        className={cn("size-3.5", className)}
        style={{ color: "#bec2c8" }}
      />
    ));

// Format status for display (capitalize)
const formatStatusLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1);

// Filter type icons
const FilterTypeIcon = ({ type }: { type: FilterType }) =>
  match(type)
    .with(FilterType.STATUS, () => (
      <ToDoIcon className="size-3.5" style={{ color: "#e2e2e2" }} />
    ))
    .with(FilterType.LABELS, () => <Tag className="size-3.5" />)
    .otherwise(() => <Tag className="size-3.5" />);

// Filter icon resolver - handles both filter types and values
const FilterIcon = ({ type, value }: { type: FilterType; value?: string }) => {
  if (type === FilterType.STATUS && value) {
    return <StatusIcon status={value as TaskStatus} />;
  }
  if (type === FilterType.LABELS && value) {
    return <div className="size-2.5 rounded-full bg-muted-foreground" />;
  }
  return <FilterTypeIcon type={type} />;
};

// Status options using actual TaskStatus values
export const statusFilterOptions: FilterOption[] = [
  { name: "planned", icon: <StatusIcon status="planned" /> },
  { name: "implemented", icon: <StatusIcon status="implemented" /> },
  { name: "verified", icon: <StatusIcon status="verified" /> },
  { name: "merging", icon: <StatusIcon status="merging" /> },
];

// Default label options (can be extended dynamically)
export const labelFilterOptions: FilterOption[] = [];

export const filterViewOptions: FilterOption[][] = [
  [
    {
      name: FilterType.STATUS,
      icon: <FilterTypeIcon type={FilterType.STATUS} />,
    },
    {
      name: FilterType.LABELS,
      icon: <FilterTypeIcon type={FilterType.LABELS} />,
    },
  ],
];

export const filterViewToFilterOptions: Record<FilterType, FilterOption[]> = {
  [FilterType.STATUS]: statusFilterOptions,
  [FilterType.LABELS]: labelFilterOptions,
};

const filterOperators = ({
  filterType,
  filterValues,
}: {
  filterType: FilterType;
  filterValues: string[];
}) =>
  match(filterType)
    .with(FilterType.STATUS, () =>
      filterValues.length > 1
        ? [FilterOperator.IS_ANY_OF, FilterOperator.IS_NOT]
        : [FilterOperator.IS, FilterOperator.IS_NOT]
    )
    .with(FilterType.LABELS, () =>
      filterValues.length > 1
        ? [
            FilterOperator.INCLUDE_ANY_OF,
            FilterOperator.INCLUDE_ALL_OF,
            FilterOperator.EXCLUDE_ALL_OF,
            FilterOperator.EXCLUDE_IF_ANY_OF,
          ]
        : [FilterOperator.INCLUDE, FilterOperator.DO_NOT_INCLUDE]
    )
    .otherwise(() => [FilterOperator.IS]);

export const getDefaultOperatorForType = (
  filterType: FilterType,
  filterValues: string[] = []
): FilterOperator => {
  const [defaultOperator] = filterOperators({ filterType, filterValues });
  return defaultOperator ?? FilterOperator.IS;
};

const FilterOperatorDropdown = ({
  filterType,
  operator,
  filterValues,
  setOperator,
}: {
  filterType: FilterType;
  operator: FilterOperator;
  filterValues: string[];
  setOperator: (operator: FilterOperator) => void;
}) => {
  const operators = filterOperators({ filterType, filterValues });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="shrink-0 bg-secondary/50 px-1.5 py-1 font-vcr text-[12px] text-muted-foreground transition hover:bg-secondary hover:text-foreground">
        {operator.toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-fit">
        {operators.map((nextOperator) => (
          <DropdownMenuItem
            className="font-vcr text-[12px]"
            key={nextOperator}
            onClick={() => setOperator(nextOperator)}
          >
            {nextOperator.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const FilterValueCombobox = ({
  filterType,
  filterValues,
  options,
  setFilterValues,
}: {
  filterType: FilterType;
  filterValues: string[];
  options: FilterOption[];
  setFilterValues: (filterValues: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const commandInputRef = useRef<HTMLInputElement>(null);
  const nonSelectedFilterValues = options.filter(
    (filter) => !filterValues.includes(filter.name)
  );
  const firstValue = filterValues[0];
  const displayValue =
    filterValues.length === 1 && firstValue
      ? formatStatusLabel(firstValue)
      : `${filterValues.length} selected`;

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setTimeout(() => setCommandInput(""), 200);
        }
      }}
      open={open}
    >
      <PopoverTrigger className="shrink-0 rounded-none bg-secondary/50 px-1.5 py-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex flex-row items-center",
              filterType === FilterType.LABELS ? "-space-x-1" : "-space-x-1"
            )}
          >
            <AnimatePresence mode="popLayout">
              {filterValues.slice(0, 3).map((value) => (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  initial={{ opacity: 0, x: -10 }}
                  key={value}
                  transition={{ duration: 0.2 }}
                >
                  <FilterIcon type={filterType} value={value} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <span className="text-xs">{displayValue}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0">
        <AnimateChangeInHeight>
          <Command>
            <CommandInput
              className="h-8 text-xs"
              onInputCapture={(event) => {
                setCommandInput(event.currentTarget.value);
              }}
              placeholder={`Filter ${filterType.toLowerCase()}...`}
              ref={commandInputRef}
              value={commandInput}
            />
            <CommandList>
              <CommandEmpty className="py-2 text-center text-muted-foreground text-xs">
                No results.
              </CommandEmpty>
              {filterValues.length > 0 && (
                <CommandGroup heading="Selected">
                  {filterValues.map((value) => (
                    <CommandItem
                      className="group flex items-center gap-2 text-xs"
                      key={value}
                      onSelect={() => {
                        setFilterValues(
                          filterValues.filter((entry) => entry !== value)
                        );
                        setTimeout(() => setCommandInput(""), 200);
                        setOpen(false);
                      }}
                    >
                      <Check className="size-3 text-foreground" />
                      <FilterIcon type={filterType} value={value} />
                      <span>{formatStatusLabel(value)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {nonSelectedFilterValues.length > 0 && (
                <>
                  {filterValues.length > 0 && <CommandSeparator />}
                  <CommandGroup heading="Available">
                    {nonSelectedFilterValues.map((filter) => (
                      <CommandItem
                        className="group flex items-center gap-2 text-xs"
                        key={filter.name}
                        onSelect={(currentValue: string) => {
                          setFilterValues([...filterValues, currentValue]);
                          setTimeout(() => setCommandInput(""), 200);
                          setOpen(false);
                        }}
                        value={filter.name}
                      >
                        <div className="size-3" />
                        {filter.icon ?? (
                          <FilterIcon type={filterType} value={filter.name} />
                        )}
                        <span>{formatStatusLabel(filter.name)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </AnimateChangeInHeight>
      </PopoverContent>
    </Popover>
  );
};

export function Filters({
  filters,
  setFilters,
  optionsByType,
  className,
}: {
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
  optionsByType?: FilterOptionsByType;
  className?: string;
}) {
  const activeFilters = filters.filter((filter) => filter.value.length > 0);

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {activeFilters.map((filter) => {
        const options =
          optionsByType?.[filter.type] ??
          filterViewToFilterOptions[filter.type] ??
          [];
        return (
          <div
            className="flex items-center overflow-hidden rounded-sm text-xs"
            key={filter.id}
          >
            <div className="flex items-center gap-1.5 bg-secondary/50 px-2 py-1">
              <FilterTypeIcon type={filter.type} />
              <span className="font-vcr text-[12px] text-muted-foreground">
                {filter.type.toUpperCase()}
              </span>
            </div>
            <FilterOperatorDropdown
              filterType={filter.type}
              filterValues={filter.value}
              operator={filter.operator}
              setOperator={(nextOperator) => {
                setFilters((prev) =>
                  prev.map((item) =>
                    item.id === filter.id
                      ? { ...item, operator: nextOperator }
                      : item
                  )
                );
              }}
            />
            <FilterValueCombobox
              filterType={filter.type}
              filterValues={filter.value}
              options={options}
              setFilterValues={(filterValues) => {
                setFilters((prev) =>
                  prev.map((item) =>
                    item.id === filter.id
                      ? { ...item, value: filterValues }
                      : item
                  )
                );
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-auto rounded-none rounded-r-sm bg-secondary/50 px-1.5 py-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  onClick={() => {
                    setFilters((prev) =>
                      prev.filter((item) => item.id !== filter.id)
                    );
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <X className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="font-vcr text-[12px]">REMOVE FILTER</span>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
