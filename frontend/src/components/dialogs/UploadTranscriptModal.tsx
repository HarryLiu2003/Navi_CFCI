import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Upload, ChevronsUpDown, Check, Search } from "lucide-react";
import { toast } from 'sonner';
import { analyzeTranscript, getProjects, Project } from '@/lib/api'; // Assuming API functions
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface UploadTranscriptModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUploadComplete: () => void; // Callback to potentially refresh interviews list
}

export function UploadTranscriptModal({ isOpen, onOpenChange, onUploadComplete }: UploadTranscriptModalProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // State for the modal
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // State for project combobox within the modal
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isProjectComboboxOpen, setIsProjectComboboxOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");

  // Fetch projects when the modal opens or session is available
  useEffect(() => {
    if (isOpen && session?.user?.id) {
      const fetchUserProjects = async () => {
        setIsLoadingProjects(true);
        try {
          // Assuming getProjects fetches projects for the logged-in user implicitly
          // or adjust getProjects call if it needs userId explicitly
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
          toast.error("Failed to load projects for assignment.");
        } finally {
          setIsLoadingProjects(false);
        }
      };
      fetchUserProjects();
    }
  }, [isOpen, session?.user?.id]);

  // Reset state when modal closes
  const handleClose = () => {
    if (isAnalyzing) return; // Don't close while analyzing
    setSelectedFile(null);
    setSelectedProjectId(undefined);
    setIsProjectComboboxOpen(false);
    setProjectSearchTerm("");
    // Don't reset projects/loading state here, only on open
    onOpenChange(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !session?.user?.id) {
      toast.error("Please select a VTT/TXT file and ensure you are logged in.");
      return;
    }

    setIsAnalyzing(true);
    toast.loading("Starting interview analysis...", { id: 'analysis-toast' });
    console.log(`[UploadTranscriptModal] Starting analysis. Selected Project ID: ${selectedProjectId}`);

    try {
      const response = await analyzeTranscript(
        selectedFile,
        session.user.id,
        selectedProjectId
      );

      if (response.status === 'success' && response.data?.storage?.id) {
        const newInterviewId = response.data.storage.id;
        toast.success("Analysis complete! Redirecting...", { id: 'analysis-toast' });
        sessionStorage.setItem('showPersonaModalForInterview', newInterviewId);
        
        onUploadComplete(); // Trigger refresh/update in parent
        handleClose();      // Close modal
        router.push(`/interview-analysis/${newInterviewId}`); // Navigate

      } else {
        throw new Error(response.message || "Analysis failed or did not return ID");
      }
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`, { id: 'analysis-toast' });
    } finally {
      setIsAnalyzing(false);
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
          <DialogTitle>Upload Interview Transcript</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* File Upload Input */}
          <div className="space-y-1.5">
            <Label htmlFor="file">Transcript File</Label>
            <Input
              id="file"
              type="file"
              accept=".vtt,.txt"
              onChange={handleFileChange}
              disabled={isAnalyzing}
              required
            />
            <p className="text-sm text-muted-foreground">
              Upload a .vtt or .txt format transcript file.
            </p>
          </div>

          {/* Project Selection Combobox */}
          <div className="space-y-1.5">
            <Label htmlFor="project-search">Assign to Project (Optional)</Label>
            <div className="relative">
              <Button
                type="button"
                id="project-search"
                variant="outline"
                role="combobox"
                aria-expanded={isProjectComboboxOpen}
                onClick={() => setIsProjectComboboxOpen(!isProjectComboboxOpen)}
                className="w-full justify-between font-normal border-border/40 hover:border-border/60 transition-colors"
                disabled={isAnalyzing || isLoadingProjects}
              >
                <span className="truncate">
                  {selectedProjectId
                    ? projects.find((project) => project.id === selectedProjectId)?.name
                    : "Select project..."}
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
          
          {/* Submit Button */} 
          <DialogFooter>
            <Button 
              type="submit" 
              className="w-full"
              disabled={!selectedFile || isAnalyzing}
            >
              {isAnalyzing ? ( 
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> 
              ) : ( 
                <><Upload className="mr-2 h-4 w-4" /> Upload and Analyze</> 
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 