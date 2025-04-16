"use client";

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button"; // Keep Button if needed for trigger, though usually external
import { Loader2 } from 'lucide-react';

interface BatchDeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void; // Or () => Promise<void> if async
  itemCount: number;
  itemTypePlural: string; // e.g., "interviews", "projects", "personas"
  isDeleting: boolean;
}

export function BatchDeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  itemCount,
  itemTypePlural,
  isDeleting,
}: BatchDeleteConfirmationDialogProps) {
  // Prevent rendering if count is zero, though parent should handle this
  if (itemCount === 0) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Trigger is typically handled by the parent component */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the selected 
            <span className="font-medium"> {itemCount} {itemTypePlural}</span> 
            and remove all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent default behavior that might close dialog prematurely if onConfirm is async
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
            ) : (
              `Delete ${itemCount} ${itemTypePlural}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 