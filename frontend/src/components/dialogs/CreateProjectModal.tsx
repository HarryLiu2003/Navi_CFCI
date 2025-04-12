import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";
import { toast } from 'sonner';
import { createProject } from '@/lib/api'; // Assuming API function is here

interface CreateProjectModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onProjectCreated: () => void; // Callback to refresh projects list in parent
}

export function CreateProjectModal({ isOpen, onOpenChange, onProjectCreated }: CreateProjectModalProps) {
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleClose = () => {
    if (isCreatingProject) return; // Don't close while creating
    setNewProjectName("");
    setNewProjectDescription("");
    onOpenChange(false);
  };

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      toast.error("Project name is required.");
      return;
    }

    setIsCreatingProject(true);
    const creationToastId = toast.loading("Creating project...");

    try {
      // NOTE: We assume createProject now gets ownerId internally or via session
      // If ownerId needs to be passed explicitly, add it as a prop
      const response = await createProject(newProjectName.trim(), newProjectDescription.trim());
      toast.success(`Project "${response.data?.name}" created successfully!`, { id: creationToastId });
      onProjectCreated(); // Trigger refresh in parent component
      handleClose(); // Close modal on success
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast.error(error.message || "An error occurred while creating the project.", {
        id: creationToastId,
        duration: 5000
      });
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Enter the details for your new project below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateProjectSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              disabled={isCreatingProject}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="projectDescription">Description (Optional)</Label>
            <Textarea
              id="projectDescription"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Enter a one-line description"
              disabled={isCreatingProject}
              rows={3}
            />
          </div>
          <DialogFooter>
            {/* Cancel button removed previously */}
            <Button
              type="submit"
              className="w-full" // Make button full width
              disabled={!newProjectName.trim() || isCreatingProject}
            >
              {isCreatingProject ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : ( 'Create Project' )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 