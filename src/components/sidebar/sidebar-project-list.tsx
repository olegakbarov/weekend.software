import { useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SidebarProjectItem } from "@/components/sidebar/sidebar-project-item";
import { useSidebarData, useSidebarActions } from "@/components/sidebar/sidebar-context";
import { DRAG_ACTIVATION_DISTANCE_PX } from "@/components/sidebar/sidebar-constants";
import { cn } from "@/lib/utils";

export function SidebarProjectList() {
  const data = useSidebarData();
  const actions = useSidebarActions();

  const displayedProjects = data.showArchived
    ? data.archivedProjects
    : data.projects;

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = data.projects.indexOf(active.id as string);
      const newIndex = data.projects.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      actions.onReorderProjects(arrayMove(data.projects, oldIndex, newIndex));
    },
    [data.projects, actions.onReorderProjects],
  );

  if (displayedProjects.length === 0 && data.showArchived) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="font-code text-xs text-muted-foreground/40">
          No archived projects
        </p>
      </div>
    );
  }

  const items = displayedProjects.map((project) => (
    <SidebarProjectItem
      key={project}
      project={project}
      isArchiveView={data.showArchived}
    />
  ));

  if (data.showArchived) {
    return (
      <div className={cn("min-h-0 flex-1 space-y-px overflow-y-auto overflow-x-hidden", "py-0.5")}>
        {items}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={cn("min-h-0 flex-1 space-y-px overflow-y-auto overflow-x-hidden", "py-1")}>
        <SortableContext
          items={data.projects}
          strategy={verticalListSortingStrategy}
        >
          {items}
        </SortableContext>
      </div>
    </DndContext>
  );
}
