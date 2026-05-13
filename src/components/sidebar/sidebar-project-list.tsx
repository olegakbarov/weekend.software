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

  const activeItems = data.projects.map((project) => (
    <SidebarProjectItem
      key={project}
      project={project}
      isArchiveView={false}
    />
  ));

  const archivedItems = data.showArchived
    ? data.archivedProjects.map((project) => (
        <SidebarProjectItem
          key={project}
          project={project}
          isArchiveView={true}
        />
      ))
    : [];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className={cn(
          "sidebar-edge-scrollbar min-h-0 flex-1 space-y-px overflow-y-auto overflow-x-hidden",
          "pb-1 pt-3",
        )}
      >
        <SortableContext
          items={data.projects}
          strategy={verticalListSortingStrategy}
        >
          {activeItems}
        </SortableContext>
        {archivedItems.length > 0 && (
          <>
            <div className="px-3 pb-0.5 pt-3">
              <p className="font-code text-[10px] uppercase tracking-wider text-muted-foreground/40">
                Archived
              </p>
            </div>
            {archivedItems}
          </>
        )}
      </div>
    </DndContext>
  );
}
