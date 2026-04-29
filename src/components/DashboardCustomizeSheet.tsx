import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type DashboardWidgetMeta = {
  id: string;
  label: string;
  description?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  widgets: DashboardWidgetMeta[];
  order: string[];
  hiddenIds: string[];
  onReorder: (next: string[]) => void;
  onToggleHidden: (id: string) => void;
  onReset: () => void;
}

function SortableRow({
  meta,
  hidden,
  onToggle,
}: {
  meta: DashboardWidgetMeta;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: meta.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border bg-card ${
        hidden ? 'border-border/40 opacity-60' : 'border-border/70 shadow-sm'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none p-1 -m-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label={`Flytta ${meta.label}`}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
          {meta.label}
          {hidden && <EyeOff className="h-3 w-3 text-muted-foreground" />}
        </p>
        {meta.description && (
          <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {hidden ? (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-primary" />
        )}
        <Switch checked={!hidden} onCheckedChange={onToggle} aria-label={`Visa ${meta.label}`} />
      </div>
    </div>
  );
}

export default function DashboardCustomizeSheet({
  open,
  onOpenChange,
  widgets,
  order,
  hiddenIds,
  onReorder,
  onToggleHidden,
  onReset,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleReset = () => {
    onReset();
    setConfirmReset(false);
    toast.success('Dashboard återställd till standard');
  };

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const orderedWidgets = order.map((id) => byId.get(id)).filter(Boolean) as DashboardWidgetMeta[];

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[88vh] overflow-y-auto p-5 sm:max-w-lg sm:mx-auto"
      >
        <SheetHeader className="text-left mb-3">
          <SheetTitle className="font-serif text-xl">Anpassa din dashboard</SheetTitle>
          <SheetDescription>
            Dra för att ändra ordning. Stäng av det du inte vill se. Inställningarna sparas och följer med
            mellan enheter.
          </SheetDescription>
        </SheetHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedWidgets.map((meta) => (
                <SortableRow
                  key={meta.id}
                  meta={meta}
                  hidden={hiddenIds.includes(meta.id)}
                  onToggle={() => onToggleHidden(meta.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2 mt-5 pt-4 border-t border-border/40">
          <Button
            variant="outline"
            className="flex-1 rounded-xl gap-2"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Återställ till standard
          </Button>
          <Button className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
            Klart
          </Button>
        </div>

        <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Återställa dashboard?</AlertDialogTitle>
              <AlertDialogDescription>
                Detta nollställer ordning och visar alla widgets igen. Dina egna data påverkas inte.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Återställ</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
