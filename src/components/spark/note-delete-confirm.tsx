"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface NoteDeleteConfirmProps {
  onDelete: () => void;
  children: React.ReactNode;
}

/** 删除便签的 Popconfirm：气泡内嵌确认，Esc 或点外部取消 */
export function NoteDeleteConfirm({
  onDelete,
  children,
}: NoteDeleteConfirmProps) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent
        size="sm"
        className="max-w-[calc(100vw-2rem)] sm:max-w-xs"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>删除这条便签？</AlertDialogTitle>
          <AlertDialogDescription>
            删除后无法恢复
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onDelete();
              toast.success("已删除", { duration: 1500 });
            }}
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
