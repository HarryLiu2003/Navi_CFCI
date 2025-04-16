import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DialogContent } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { DialogHeader } from "@/components/ui/dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Loader2 } from 'lucide-react';
import { Project } from '@/lib/api'; // Import Project type

interface EditProjectDialogProps {
  project: Project | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedData: { name: string; description?: string | null }) => Promise<void>; // Return promise to handle async save
}

export function EditProjectDialog({ 
  project,
  isOpen,
  onOpenChange,
  onSave,
}: EditProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update state when the project prop changes (e.g., when dialog opens)
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setError(null); // Clear previous errors
    } else {
      // Reset fields if project is null (dialog closed or no project)
      setName('');
      setDescription('');
      setError(null);
    }
  }, [project, isOpen]); // Depend on isOpen as well to reset on close

  const handleSaveClick = async () => {
    if (!project || !name.trim()) {
      setError('Project name cannot be empty.');
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      await onSave({ 
        name: name.trim(), 
        // Ensure description is sent as null if empty, or the trimmed value
        description: description.trim() === '' ? null : description.trim() 
      });
      // onSave should handle closing the dialog on success
    } catch (err) {
      // Error handling might be done in the parent component via onSave reject
      // Or display a generic error here
      setError(err instanceof Error ? err.message : 'Failed to save project.');
      console.error("Error saving project:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle closing the dialog
  const handleOpenChange = (open: boolean) => {
    if (!isSaving) { // Prevent closing while saving
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the name and description for your project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="col-span-3" 
              disabled={isSaving}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4"> {/* Changed items-center to items-start for Textarea label */} 
            <Label htmlFor="description" className="text-right pt-2"> {/* Added padding-top for alignment */} 
              Description
            </Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional project description..."
              className="col-span-3 min-h-[80px]" // Added min-height
              disabled={isSaving}
            />
          </div>
          {error && (
            <p className="col-span-4 text-sm text-red-600 text-center">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSaveClick} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
 