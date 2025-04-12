import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RefreshCw, ChevronsUpDown, Check, Search } from "lucide-react";
import { toast } from 'sonner';
import { getProjects, updateInterview, Project } from '@/lib/api'; 
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface ChangeProjectModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  interviewId: string;
  currentProjectId: string | undefined | null;
  onProjectChanged: (newProjectId: string | undefined) => void; // Callback to update parent state
}

export function ChangeProjectModal({ 
  isOpen, 
  onOpenChange, 
  interviewId,
  currentProjectId,
  onProjectChanged
}: ChangeProjectModalProps) {
  const { data: session } = useSession();

  // State for the modal
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // State for project combobox within the modal
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isProjectComboboxOpen, setIsProjectComboboxOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");

  // Set initial selected project when modal opens or currentProjectId changes
  useEffect(() => {
      setSelectedProjectId(currentProjectId ?? undefined);
  }, [isOpen, currentProjectId]);

  // Fetch projects when the modal opens
  useEffect(() => {
    if (isOpen && session?.user?.id) {
      const fetchUserProjects = async () => {
        setIsLoadingProjects(true);
        try {
          const response = await getProjects(100, 0);
          if (response?.status === 'success' && response.data?.projects) {
            setProjects(response.data.projects);
          } else {
            setProjects([]);
            console.warn("No projects found or failed response:", response?.message);
          }
        } catch (error) {
          console.error('Error fetching projects for modal:', error);
          setProjects([]);
          toast.error("Failed to load projects.");
        } finally {
          setIsLoadingProjects(false);
        }
      };
      fetchUserProjects();
    }
  }, [isOpen, session?.user?.id]);

  // Reset combobox state when modal closes, keep selectedId based on prop
  const handleClose = () => {
    if (isUpdating) return; // Don't close while updating
    setIsProjectComboboxOpen(false);
    setProjectSearchTerm("");
    onOpenChange(false);
  };

  const handleUpdateProject = async () => {
    if (!interviewId) {
        toast.error("Interview ID is missing. Cannot update project.");
        return;
    }
    // Check if the selection actually changed
    if (selectedProjectId === (currentProjectId ?? undefined)) {
        toast.info("No changes made to project assignment.");
        handleClose();
        return;
    }

    setIsUpdating(true);
    const updateToastId = toast.loading("Updating project assignment...");

    try {
        const result = await updateInterview(interviewId, { 
            project_id: selectedProjectId // Pass undefined to remove project link
        });
        
        if (result.status === 'success') {
            toast.success("Project updated successfully", { id: updateToastId });
            onProjectChanged(selectedProjectId); // Update parent state
            handleClose(); // Close modal
        } else {
            toast.error("Failed to update project", { id: updateToastId });
        }
    } catch (error) {
        console.error("Error updating project:", error);
        toast.error("An error occurred while updating the project", { id: updateToastId });
    } finally {
        setIsUpdating(false);
    }
  };

  // Filter projects for combobox search
  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Project Assignment</DialogTitle>
          <DialogDescription>
            Select a project to assign this interview to, or choose (No Project).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {/* Project Selection Combobox */}
            <div className="space-y-1.5">
                <Label htmlFor="project-change-search">Project</Label>
                <div className="relative">
                    <Button
                        type="button"
                        id="project-change-search"
                        variant="outline"
                        role="combobox"
                        aria-expanded={isProjectComboboxOpen}
                        onClick={() => setIsProjectComboboxOpen(!isProjectComboboxOpen)}
                        className="w-full justify-between font-normal border-border/40 hover:border-border/60 transition-colors"
                        disabled={isUpdating || isLoadingProjects}
                    >
                        <span className="truncate">
                        {selectedProjectId
                            ? projects.find((project) => project.id === selectedProjectId)?.name
                            : "(No Project)"} 
                        </span>
                        {isLoadingProjects ? (
                        <RefreshCw className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
                        ) : (
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        )}
                    </Button>
                    
                    {isProjectComboboxOpen && (
                        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border/40 bg-background shadow-md">
                        <div className="flex items-center border-b px-3 py-2">
                            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                            <input
                            placeholder="Search projects..."
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                            value={projectSearchTerm}
                            onChange={(e) => setProjectSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()} // Prevent closing dropdown
                            autoFocus
                            />
                        </div>
                        <div className="max-h-[200px] overflow-auto p-1">
                            {isLoadingProjects ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">Loading...</div>
                            ) : projects.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">No projects found.</div>
                            ) : (
                            <>
                                {/* No Project Option */} 
                                <div
                                data-project-item
                                data-project-name="no-project"
                                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50"
                                onClick={() => {
                                    setSelectedProjectId(undefined);
                                    setIsProjectComboboxOpen(false);
                                }}
                                >
                                <Check 
                                    className={cn(
                                    "h-4 w-4 mr-2",
                                    selectedProjectId === undefined ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <span>(No Project)</span>
                                </div>
                                {/* Filtered Project List */} 
                                {filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    data-project-item
                                    data-project-name={project.name}
                                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50"
                                    onClick={() => {
                                    setSelectedProjectId(project.id);
                                    setIsProjectComboboxOpen(false);
                                    }}
                                >
                                    <Check 
                                    className={cn(
                                        "h-4 w-4 mr-2",
                                        selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                                    )}
                                    />
                                    <span>{project.name}</span>
                                </div>
                                ))}
                                {/* No Results Message */} 
                                {filteredProjects.length === 0 && projectSearchTerm !== "" && (
                                <div className="px-2 py-3 text-sm text-muted-foreground text-center">No projects match "{projectSearchTerm}".</div>
                                )}
                            </>
                            )}
                        </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <DialogFooter>
            <Button 
                variant="outline"
                onClick={handleClose}
                disabled={isUpdating}
             >
               Cancel
             </Button>
            <Button 
              onClick={handleUpdateProject}
              disabled={isUpdating || isLoadingProjects || selectedProjectId === (currentProjectId ?? undefined)} // Disable if no change or loading
            >
              {isUpdating ? ( 
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...</> 
              ) : ( 
                <>Save Changes</> 
              )}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 