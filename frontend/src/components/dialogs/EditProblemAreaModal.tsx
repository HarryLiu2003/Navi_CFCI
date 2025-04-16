import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { ProblemArea, updateProblemArea } from '@/lib/api';
import { toast } from 'sonner';

interface EditProblemAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  problemArea: ProblemArea | null;
  onSaveSuccess: (updatedProblemArea: ProblemArea) => void;
}

export const EditProblemAreaModal: React.FC<EditProblemAreaModalProps> = ({ 
  isOpen, 
  onClose, 
  problemArea, 
  onSaveSuccess 
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize state when the problemArea prop changes (when modal opens)
  useEffect(() => {
    if (problemArea) {
      setTitle(problemArea.title || '');
      setDescription(problemArea.description || '');
      setError(null); // Reset error on open
    } else {
        // Reset fields if no problemArea is provided (e.g., modal closed then reopened quickly)
        setTitle('');
        setDescription('');
        setError(null);
    }
  }, [problemArea]);

  const handleSave = async () => {
    if (!problemArea || !problemArea.id) {
        toast.error("Cannot save: Problem area data is missing.");
        return;
    }
    if (!title.trim()) {
        setError("Title cannot be empty.");
        return;
    }
    if (!description.trim()) {
         setError("Description cannot be empty.");
        return;
    }
    
    setError(null);
    setIsSaving(true);

    try {
        const updatePayload: { title?: string; description?: string } = {};
        if (title.trim() !== problemArea.title) {
            updatePayload.title = title.trim();
        }
        if (description.trim() !== problemArea.description) {
            updatePayload.description = description.trim();
        }

        // Only call API if there are actual changes
        if (Object.keys(updatePayload).length > 0) {
            const result = await updateProblemArea(problemArea.id, updatePayload);
            if (result.status === 'success' && result.data) {
                onSaveSuccess(result.data); // Pass updated data back to parent
                // onClose(); // Let parent handle closing via onSaveSuccess if preferred
            } else {
                toast.error(result.message || "Failed to update problem area.");
                setError(result.message || "Failed to save changes.");
            }
        } else {
            toast.info("No changes detected.");
            onClose(); // Close if no changes were made
        }
    } catch (error: any) {
        const message = error.message || "An unknown error occurred.";
        toast.error(`Error saving: ${message}`);
        setError(message);
    } finally {
        setIsSaving(false);
    }
  };

  // Handle modal close/open state changes from parent
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose(); // Call the onClose passed from parent
    }
    // Parent controls the actual opening via the isOpen prop
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Problem Area</DialogTitle>
          <DialogDescription>
            Refine the title and description for this identified problem area.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input 
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              maxLength={100} // Add a reasonable max length
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">
              Description
            </Label>
            <Textarea 
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-[100px]" 
              maxLength={500} // Add a reasonable max length
            />
          </div>
          {error && (
            <p className="col-span-4 text-sm text-destructive text-center">{error}</p>
          )}
        </div>
        <DialogFooter>
           <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 