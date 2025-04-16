import React from 'react';
import { AlertDialog } from "@/components/ui/alert-dialog";
import { AlertDialogAction } from "@/components/ui/alert-dialog";
import { AlertDialogCancel } from "@/components/ui/alert-dialog";
import { AlertDialogContent } from "@/components/ui/alert-dialog";
import { AlertDialogDescription } from "@/components/ui/alert-dialog";
import { AlertDialogFooter } from "@/components/ui/alert-dialog";
import { AlertDialogHeader } from "@/components/ui/alert-dialog";
import { AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface DeleteProjectConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (force: boolean) => void;
  projectName: string;
  isDeleting: boolean;
}

export function DeleteProjectConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  projectName,
  isDeleting,
}: DeleteProjectConfirmationDialogProps) {
  const [forceDelete, setForceDelete] = React.useState(false);

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) setForceDelete(false);
      onOpenChange(isOpen);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            project <span className="font-semibold text-foreground">{projectName}</span>.
            <br />
            <span className="text-destructive font-semibold">Warning:</span> Deleting a project with interviews requires force deletion, which will also delete all associated interviews and problem areas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 mt-4">
          <Checkbox 
            id="force-delete-checkbox" 
            checked={forceDelete}
            onCheckedChange={(checked) => setForceDelete(Boolean(checked))} 
            disabled={isDeleting}
          />
          <Label 
            htmlFor="force-delete-checkbox"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Force delete (delete project and all associated interviews/problem areas)
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { 
              e.preventDefault();
              onConfirm(forceDelete);
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              forceDelete ? 'Yes, FORCE delete project' : 'Yes, delete project'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
 