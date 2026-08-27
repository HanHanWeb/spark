"use client";

import { useMemo, useCallback } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/components/kibo-ui/kanban";
import { cn } from "@/lib/utils";
import { type Category, type Note, type Priority } from "@/lib/notes";
import { CategoryChip } from "@/components/spark/category-chip";
import { PriorityChip } from "@/components/spark/priority-chip";
import { NoteDeleteConfirm } from "@/components/spark/note-delete-confirm";

type KanbanItem = {
  id: string;
  name: string;
  column: string;
  note: Note;
};

type Props = {
  notes: Note[];
  categories: Category[];
  onNotesChange: (next: Note[]) => void;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, p: Priority) => void;
};

export function NoteKanban({
  notes,
  categories,
  onNotesChange,
  onToggleDone,
  onDelete,
  onPriorityChange,
}: Props) {
  const columns = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name })),
    [categories]
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const data: KanbanItem[] = useMemo(
    () =>
      notes.map((n) => ({
        id: n.id,
        name: n.content,
        column: n.categoryId,
        note: n,
      })),
    [notes]
  );

  const handleDataChange = useCallback(
    (nextData: KanbanItem[]) => {
      // nextData is ordered as rendered after drag; map back to Note[]
      const noteById = new Map(notes.map((n) => [n.id, n]));
      const nextNotes: Note[] = [];
      for (const item of nextData) {
        const orig = noteById.get(item.id);
        if (!orig) continue;
        const updated: Note =
          orig.categoryId === item.column
            ? orig
            : { ...orig, categoryId: item.column };
        nextNotes.push(updated);
      }
      // Notes that were filtered out? In this board all notes are shown, so 1-1.
      // Preserve any missing (should not happen) at end
      if (nextNotes.length !== notes.length) {
        const seen = new Set(nextNotes.map((n) => n.id));
        for (const n of notes) if (!seen.has(n.id)) nextNotes.push(n);
      }
      onNotesChange(nextNotes);
    },
    [notes, onNotesChange]
  );

  if (categories.length === 0) return null;

  return (
    <div className="mt-4 w-full pb-2">
      <KanbanProvider
        columns={columns}
        data={data}
        onDataChange={handleDataChange as never}
        className="gap-4 items-start"
      >
        {(column) => {
          const cat = categoryMap.get(column.id);
          if (!cat) return null;
          const idx = columns.findIndex((c) => c.id === column.id);
          return (
            <div
              key={column.id}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both"
              style={{ animationDelay: `${idx * 90}ms` }}
            >
              <KanbanBoard id={column.id} className="w-full bg-card/50 border shadow-sm">
              <KanbanHeader className="flex items-center border-b bg-muted/40 px-3 py-2.5">
                <CategoryChip category={cat} className="text-xs" />
              </KanbanHeader>

              <KanbanCards
                id={column.id}
                className="min-h-[160px] gap-2.5 p-2.5"
              >
                {(item: KanbanItem) => {
                  const note = item.note;
                  const done = note.done === true;
                  const curPriority = (note.priority ?? "medium") as Priority;
                  const nextPriority: Priority =
                    curPriority === "low" ? "medium" : curPriority === "medium" ? "high" : "low";
                  return (
                    <KanbanCard
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      column={item.column}
                      className={cn(
                        "overflow-hidden p-0 bg-card border shadow-none transition-colors",
                        done && "opacity-60"
                      )}
                    >
                      <div className="p-3 pb-2">
                        <p
                          className={cn(
                            "text-sm leading-relaxed break-words whitespace-pre-wrap",
                            done && "line-through decoration-muted-foreground/60"
                          )}
                        >
                          {note.content}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
                        <button
                          type="button"
                          aria-label={`优先级：${curPriority}，点击切换`}
                          title="点击切换优先级：低 → 中 → 高"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPriorityChange(note.id, nextPriority);
                          }}
                          className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-full"
                        >
                          <PriorityChip priority={curPriority} className="h-6 px-2 py-0 text-[11px]" />
                        </button>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            type="button"
                            aria-label={done ? "标记为未完成" : "标记为已完成"}
                            title={done ? "标记为未完成" : "标记为已完成"}
                            className={cn(
                              "p-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-full",
                              done ? "text-green-600 hover:text-green-700" : "text-green-600/60 hover:text-green-600"
                            )}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleDone(note.id);
                            }}
                          >
                            <CheckIcon className="size-4" />
                          </button>
                          <NoteDeleteConfirm onDelete={() => onDelete(note.id)}>
                            <button
                              type="button"
                              aria-label="删除这条便签"
                              className="p-0 bg-transparent text-red-500 hover:text-red-600 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-full"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <XIcon className="size-4" />
                            </button>
                          </NoteDeleteConfirm>
                        </div>
                      </div>
                    </KanbanCard>
                  );
                }}
              </KanbanCards>
              </KanbanBoard>
            </div>
          );
        }}
      </KanbanProvider>
    </div>
  );
}
