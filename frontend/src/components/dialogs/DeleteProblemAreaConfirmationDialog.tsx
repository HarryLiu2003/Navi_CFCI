import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle } from 'lucide-react'

interface DeleteProblemAreaConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void; // Parent handles the actual deletion logic
  problemAreaTitle: string;
  isDeleting: boolean;
}

export const DeleteProblemAreaConfirmationDialog: React.FC<DeleteProblemAreaConfirmationDialogProps> = ({ 
  open, 
  onOpenChange, 
  onConfirm, 
  problemAreaTitle, 
  isDeleting 
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> 
            Confirm Deletion
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            Are you sure you want to permanently delete the problem area titled 
            <strong className="px-1">"{problemAreaTitle}"</strong>?
            All associated excerpts will also be deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={onConfirm} 
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete Problem Area
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}; 