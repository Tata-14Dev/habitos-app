import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { t } from './i18n'

/** Vertical list reorderable by dragging the ⠿ handle (mouse, touch or keyboard). */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
  className,
}: {
  items: T[]
  onReorder: (ids: string[]) => void
  render: (item: T, handle: ReactNode) => ReactNode
  className?: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const ids = items.map((i) => i.id)
    onReorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <Row key={item.id} id={item.id}>
              {(handle) => render(item, handle)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Row({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      aria-label={t('Arrastrar para reordenar')}
      className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-lg text-ink-soft dark:text-neutral-400 active:cursor-grabbing"
    >
      ⠿
    </button>
  )
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 rounded-xl bg-white opacity-90 shadow-lg dark:bg-neutral-800' : undefined}
    >
      {children(handle)}
    </li>
  )
}
