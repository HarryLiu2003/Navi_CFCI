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
import { Loader2 } from 'lucide-react';

interface DeletePersonaConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void; // Or () => Promise<void> if async
  personaName: string; // Specifically for persona name
  isDeleting: boolean;
}

export function DeletePersonaConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  personaName,
  isDeleting,
}: DeletePersonaConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Trigger is handled by the parent component (e.g., a button in PersonaTaggingModal) */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Persona?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the persona 
            "<span className="font-medium">{personaName || 'this persona'}</span>"?
            <br />
            This action cannot be undone. The persona will be removed from all associated interviews.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); 
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
            ) : (
              'Delete Persona' // More specific action text
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 