"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  ChevronLeft, 
  Copy, 
  LayoutGrid, 
  Rows, 
  ChevronDown, 
  ChevronUp, 
  Search,
  Info,
  AlertCircle,
  Lightbulb,
  Loader2,
  Users, 
  Mic, 
  CalendarDays,
  Bell,
  Settings,
  User,
  LogOut,
  ChevronsUpDown,
  Plus,
  Check,
  Trash2,
  MoreHorizontal,
  Undo2,
  Edit,
  CheckCircle2,
  Circle,
} from "lucide-react"
import Link from "next/link"
import { 
  getInterviewById, 
  updateInterview, 
  getAllPersonas, 
  getProjects, 
  deleteInterview, 
  updateProblemArea, 
  confirmProblemArea, 
  deleteProblemArea 
} from '@/lib/api'
import { toast } from 'sonner'
import { use } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { PersonaTaggingModal } from '@/components/dialogs/PersonaTaggingModal'
import { EditProblemAreaModal } from '@/components/dialogs/EditProblemAreaModal'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChangeProjectModal } from '@/components/dialogs/ChangeProjectModal'
import { Interview, Persona, ProblemArea, Excerpt } from '@/lib/api' // Use updated types
import { getPersonaColorById } from '@/lib/constants'
import { SingleDeleteConfirmationDialog } from '@/components/dialogs/SingleDeleteConfirmationDialog'
import { DeleteProblemAreaConfirmationDialog } from '@/components/dialogs/DeleteProblemAreaConfirmationDialog' // Import new dialog
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb"

// Define category colors for consistency
const categoryColors = {
  "Current Approach": "bg-blue-100 text-blue-800 border-blue-200",
  "Pain Point": "bg-red-100 text-red-800 border-red-200",
  "Ideal Solution": "bg-green-100 text-green-800 border-green-200",
  "Impact": "bg-purple-100 text-purple-800 border-purple-200"
} as const;

// For TypeScript typing
interface TranscriptChunk {
  chunk_number: number;
  speaker: string;
  text: string;
  timestamp?: string; // Add optional timestamp field
}

interface PageProps {
  params: Promise<{ id: string }>
}

// Define priority options with updated styling
const priorityOptions = [
    { value: 'L', label: 'High', color: 'bg-red-500/20 hover:bg-red-500/30 text-red-700 border-red-200' },
    { value: 'M', label: 'Medium', color: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-700 border-yellow-200' },
    { value: 'S', label: 'Low', color: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 border-blue-200' },
];

// Helper to get priority badge style
const getPriorityBadgeClass = (priority: string | null | undefined): string => {
  switch (priority) {
    case 'L': return "bg-red-500/20 text-red-700 border-red-200";
    case 'M': return "bg-yellow-500/20 text-yellow-700 border-yellow-200";
    case 'S': return "bg-blue-500/20 text-blue-700 border-blue-200";
    default: return "bg-muted/50 text-muted-foreground border-muted"; // Default style for no priority
  }
};

export default function InterviewAnalysisDetail({ params }: PageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interview, setInterview] = useState<Interview | null>(null)
  const resolvedParams = use(params)
  
  const { data: session, status } = useSession();
  
  // State for inline title editing
  const [currentTitle, setCurrentTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [saveError, setSaveError] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null); // Ref for the h1 element
  
  // For tab view
  const [activeTab, setActiveTab] = useState('problems')
  
  // For transcript highlighting and scrolling
  const [activeChunk, setActiveChunk] = useState<number | null>(null)
  const chunkRefs = useRef<Record<number, HTMLDivElement | null>>({})
  
  // For expandable problem areas
  const [expandedProblemIds, setExpandedProblemIds] = useState<string[]>([])
  
  // For search functionality
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  
  // State for Persona Modal
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [allPersonas, setAllPersonas] = useState<Persona[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);

  // Project assignment state
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isChangingProject, setIsChangingProject] = useState(false);

  // Add this near other state definitions
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  // Rename state for clarity
  const [showChangeProjectModal, setShowChangeProjectModal] = useState(false);

  // New state for hovering over tags
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null);

  // State to prevent concurrent fetches
  const [isFetchingInterview, setIsFetchingInterview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingInterview, setIsDeletingInterview] = useState(false);

  // --- NEW STATE for scroll-back ---
  const [originatingElementId, setOriginatingElementId] = useState<string | null>(null);

  // --- NEW state for Editing Problem Area --- 
  const [editingProblemArea, setEditingProblemArea] = useState<ProblemArea | null>(null);
  const [showEditProblemAreaModal, setShowEditProblemAreaModal] = useState(false);

  // --- NEW state for Confirming Problem Area --- 
  const [confirmingProblemId, setConfirmingProblemId] = useState<string | null>(null);

  // --- NEW state for Inline Editing ---
  const [editingPAData, setEditingPAData] = useState<{ id: string; title: string; description: string } | null>(null);
  const problemAreaSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- NEW State for Deleting Problem Area --- 
  const [deletingProblemAreaInfo, setDeletingProblemAreaInfo] = useState<{ id: string; title: string } | null>(null);
  const [isProcessingPADelete, setIsProcessingPADelete] = useState(false); // Separate loading state for PA delete

  // --- State for Confirming Problem Area & Priority --- 
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [selectingPriorityForPA, setSelectingPriorityForPA] = useState<ProblemArea | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  // Extracted function to fetch interview data
  const fetchInterviewData = useCallback(async () => {
    if (isFetchingInterview || !resolvedParams.id) return;
    
    setIsFetchingInterview(true);
    setIsLoading(true); 
    setError(null);
    
    console.log("[page.tsx] Refetching interview data...");
    
    try {
      const interviewResponse = await getInterviewById(resolvedParams.id);
      
      if (interviewResponse.status === "success" && interviewResponse.data) {
        const fetchedInterview = interviewResponse.data;
        setInterview(fetchedInterview);
        const initialTitle = fetchedInterview?.title || "Interview Analysis";
        setCurrentTitle(initialTitle);
        setOriginalTitle(initialTitle);
        console.log("[page.tsx] Interview data refetched successfully.");
      } else {
        setError(interviewResponse.message || "Failed to refetch interview data");
        console.error("[page.tsx] Failed to refetch interview data:", interviewResponse.message);
      }
    } catch (fetchError) {
      console.error("[page.tsx] Error refetching interview data:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "An unknown error occurred during refetch");
    } finally {
      setIsFetchingInterview(false);
      setIsLoading(false);
    }
  }, [resolvedParams.id, isFetchingInterview]); 

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return; 
    }

    if (status === "authenticated") {
      const fetchInitialData = async () => {
        if (isFetchingInterview) return; 
        
        setError(null);
        setPersonasError(null);
        setIsLoading(true);
        setIsFetchingInterview(true);
        
        try {
          const [interviewResponse, projectsResponse] = await Promise.all([
            getInterviewById(resolvedParams.id),
            getProjects(100, 0)
          ]);
          
          let fetchedInterview: Interview | null = null; 
          
          if (interviewResponse.status === "success" && interviewResponse.data) {
            fetchedInterview = interviewResponse.data;
            setInterview(fetchedInterview);
            const initialTitle = fetchedInterview?.title || "Interview Analysis";
            setCurrentTitle(initialTitle);
            setOriginalTitle(initialTitle);
          } else {
            setError(interviewResponse.message || "Failed to load interview data");
          }

          // Handle projects data
          if (projectsResponse.status === 'success') {
            setProjects(projectsResponse.data?.projects || []);
          } else {
            // Optionally handle project fetch error
             console.warn("Failed to fetch projects:", projectsResponse.message);
          }

          // --- Check sessionStorage flag for Persona Modal --- 
          const flagInterviewId = sessionStorage.getItem('showPersonaModalForInterview');
          let shouldShowModal = false;
          
          if (flagInterviewId && flagInterviewId === resolvedParams.id && fetchedInterview) {
            sessionStorage.removeItem('showPersonaModalForInterview'); 
            const needsPersonaTagging = !fetchedInterview.personas || fetchedInterview.personas.length === 0;
            if (needsPersonaTagging) {
              shouldShowModal = true;
            }
          }
          
          // Fetch personas if needed for modal
          if (shouldShowModal) {
            setIsLoadingPersonas(true);
            try {
              const personasResponse = await getAllPersonas();
              if (personasResponse.status === 'success') {
                setAllPersonas(personasResponse.data || []);
                setShowPersonaModal(true); // Show modal *after* personas are fetched
              } else {
                setPersonasError(personasResponse.message || 'Failed to fetch personas for tagging.');
                toast.error(personasResponse.message || 'Could not load personas for tagging.');
              }
            } catch (personaFetchError: any) {
              const message = personaFetchError.message || 'Error fetching personas.';
              setPersonasError(message);
              toast.error(`Error loading personas: ${message}`);
            } finally {
              setIsLoadingPersonas(false);
            }
          }
        } catch (fetchError) {
          console.error("[page.tsx] Error fetching initial data:", fetchError);
          setError(fetchError instanceof Error ? fetchError.message : "An unknown error occurred during initial load");
        } finally {
          setIsLoading(false);
          setIsFetchingInterview(false);
        }
      };
      
      fetchInitialData();
    }
  }, [resolvedParams.id, status, router]);

  // --- Title Editing Logic (contentEditable version) ---

  // Debounced save function (updated UX)
  const debouncedSave = useCallback((newTitle: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      const trimmedTitle = newTitle.trim();
      
      if (trimmedTitle === originalTitle.trim()) {
        console.log("[page.tsx] Title unchanged (after trim), skipping save.");
        setCurrentTitle(originalTitle);
        setSaveError(false);
        return;
      }
      if (!trimmedTitle) {
         console.log("[page.tsx] Title is empty, reverting and skipping save.");
         setCurrentTitle(originalTitle);
         setSaveError(false);
         return;
      }
      if (!resolvedParams.id) {
          console.error("Cannot save: Interview ID is missing.");
          return;
      }

      setSaveError(false);
      console.log(`[page.tsx] Saving title: ${trimmedTitle}`);

      try {
        const result = await updateInterview(resolvedParams.id, { title: trimmedTitle });
        if (result.status === 'success') {
          setOriginalTitle(trimmedTitle);
          setCurrentTitle(trimmedTitle);
          console.log("[page.tsx] Title saved successfully.");
        } else {
          setCurrentTitle(originalTitle);
          setSaveError(true);
          console.error("[page.tsx] Failed to save title:", result);
        }
      } catch (error) {
        setCurrentTitle(originalTitle);
        setSaveError(true);
        console.error("[page.tsx] Error saving title:", error);
      }
    }, 1000); 
  }, [resolvedParams.id, originalTitle]);

  // Update state on input, extracting plain text
  const handleTitleInput = (event: React.FormEvent<HTMLHeadingElement>) => {
    if (saveError) setSaveError(false);
  };

  // Handle clicking away (blur)
  const handleTitleBlur = (event: React.FocusEvent<HTMLHeadingElement>) => {
    const finalTitle = event.currentTarget.innerText || "";
    setCurrentTitle(finalTitle);
    debouncedSave(finalTitle);
  };

  // Handle pressing Enter/Escape keys
  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        event.currentTarget.innerText = originalTitle;
        setSaveError(false);
        setCurrentTitle(originalTitle);
        event.currentTarget.blur();
    }
  };

  // --- End Title Editing Logic ---

  // Function to format date to a human-readable format
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return 'Unknown date'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }
  
  // --- Expand/Collapse Logic (MODIFIED to only allow one open at a time) ---
  const toggleProblemExpansion = (problemAreaId: string) => {
    setExpandedProblemIds((prevExpandedIds) => {
      // If the clicked ID is already the only one expanded, collapse it (set to empty array).
      if (prevExpandedIds.length === 1 && prevExpandedIds[0] === problemAreaId) {
        return [];
      }
      // Otherwise, expand the clicked one (setting it as the only element in the array).
      return [problemAreaId]; 
    });
  }

  // Scroll to chunk in transcript
  const scrollToChunk = (chunkNumber: number, triggerElementId: string | null = null) => {
    // Store the originating element ID *before* scrolling/tab switching
    setOriginatingElementId(triggerElementId);
    
    setActiveChunk(chunkNumber)
    
    // Switch to transcript tab
    setActiveTab('transcript')
    
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      const targetChunk = chunkRefs.current[chunkNumber];
      if (targetChunk) {
        targetChunk.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      } else {
        console.warn(`Chunk ref ${chunkNumber} not found for scrolling.`)
      }
    }, 100) // Small delay might be needed for tab switch
  }

  // --- Function to scroll back to the originating element ---
  const scrollToOriginatingElement = () => {
    if (!originatingElementId) return;

    // Switch back to problems tab
    setActiveTab('problems');

    // Use setTimeout to allow tab switch and rendering
    setTimeout(() => {
        const element = document.getElementById(originatingElementId);
        if (element) {
            element.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
             // Optional: Add a temporary highlight effect to the originating card
            element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
            setTimeout(() => {
                element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
            }, 1500); // Remove highlight after 1.5 seconds
        } else {
            console.warn(`Originating element with ID ${originatingElementId} not found.`);
        }
        // Reset state after scrolling back
        setOriginatingElementId(null);
        // Optionally reset activeChunk if desired, or keep it highlighted briefly
        // setActiveChunk(null);
    }, 100);
  };

  // --- Helper Functions --- 
  // Update getInitials for single initial
  const getInitials = (name?: string | null) => {
    // Handle null, undefined, empty, or whitespace-only strings
    if (!name || name.trim().length === 0) return "?"
    // Take the first character of the trimmed string and uppercase it
    return name.trim()[0].toUpperCase();
  }

  // --- Function to fetch all personas (used by Edit button and onDeleteSuccess) ---
  const fetchAllPersonas = useCallback(async () => {
    // No need to set loading state here if called internally
    try {
      console.log("[page.tsx] Refetching all personas list...");
      const personasResponse = await getAllPersonas();
      if (personasResponse.status === 'success') {
        setAllPersonas(personasResponse.data || []);
         console.log("[page.tsx] All personas list updated.");
      } else {
        // Keep existing personas list, show error
        setPersonasError(personasResponse.message || 'Failed to refresh personas list.');
        toast.error(personasResponse.message || 'Could not refresh personas list.');
      }
    } catch (error: any) {
      const message = error.message || 'Error refreshing personas list.';
      setPersonasError(message);
      toast.error(`Error refreshing personas: ${message}`);
    }
  }, []); // No dependencies needed if just fetching
  
  // --- Callback for Persona Modal Save ---
  const handlePersonaSaveSuccess = useCallback((updatedPersonas: Persona[]) => {
    console.log("[page.tsx] Persona save successful, updating interview state.");
    setInterview((prevInterview: Interview | null) => {
      if (!prevInterview) return null;
      // Update the personas list directly based on the successful save
      const updatedInterview = { ...prevInterview, personas: updatedPersonas };
      // Also update the original title if it matches current (in case save happened)
      if (updatedInterview.title === currentTitle) {
          setOriginalTitle(currentTitle);
      }
      return updatedInterview;
    });
    // After successful save, also refresh the full list of personas 
    // in case new ones were created during the save process in the modal.
    fetchAllPersonas(); 
  }, [currentTitle, fetchAllPersonas]); // Add fetchAllPersonas dependency
  
  // --- Callback for Persona Modal Open/Close (REVISED) ---
  const handlePersonaModalOpenChange = useCallback(async (open: boolean) => {
    // Always update modal visibility immediately
    setShowPersonaModal(open);

    if (!open) {
      // Modal is closing. Refetch *both* interview and all personas
      // regardless of whether it was saved or cancelled.
      console.log("[page.tsx] Persona modal closed. Refetching interview and all personas list.");
      
      // Use Promise.allSettled to fetch concurrently and handle potential errors individually
      await Promise.allSettled([
        fetchInterviewData(),
        fetchAllPersonas()
      ]);
      console.log("[page.tsx] Refetch operations complete after modal close.");
    }
  }, [fetchInterviewData, fetchAllPersonas]); // Depend on the fetch functions

  // --- Callback for Persona Deletion inside Modal (SIMPLIFIED) ---
  const handlePersonaDeleteSuccess = useCallback((deletedPersonaId: string) => {
    console.log(`[page.tsx] Persona deleted (ID: ${deletedPersonaId}) within modal. Refreshing all personas list.`);
    
    // When a persona is deleted *within* the modal, the only immediate action needed
    // on the parent page is to refresh the list of available personas.
    // The *linking* status will be correctly handled by the refetch 
    // when the modal eventually closes (via handlePersonaModalOpenChange).
    fetchAllPersonas();

  }, [fetchAllPersonas]); // Depend on fetchAllPersonas

  // --- Callback for Change Project Modal Save (NEW) ---
  const handleProjectChangeSuccess = useCallback((newProjectId: string | undefined) => {
    setInterview((prevInterview) => {
        if (!prevInterview) return null;
        const newProject = projects.find(p => p.id === newProjectId);
        const finalProjectId: string | null = newProjectId === undefined ? null : newProjectId;
        return {
            ...prevInterview,
            project_id: finalProjectId,
            project: newProject || null 
        };
    });
  }, [projects]); // Depend on projects list so newProject is updated correctly

  // --- Delete Interview Logic ---
  const handleDeleteInterview = async () => {
    if (!resolvedParams.id) {
      toast.error("Cannot delete: Interview ID is missing.");
      return;
    }
    setIsDeletingInterview(true);
    try {
      const result = await deleteInterview(resolvedParams.id);
      if (result.status === 'success') {
        toast.success(`Interview "${interview?.title || 'Untitled'}" deleted successfully.`);
        // Replace client-side navigation with a full page reload
        // router.push('/'); 
        window.location.assign('/'); // Force full reload to dashboard
      } else {
        toast.error(`Failed to delete interview: ${result.message}`);
        setShowDeleteConfirm(false); // Close confirm dialog on error
      }
    } catch (error) {
      console.error("Error deleting interview:", error);
      toast.error("An unexpected error occurred while deleting the interview.");
      setShowDeleteConfirm(false); // Close confirm dialog on error
    } finally {
      setIsDeletingInterview(false);
    }
  };

  // --- Helper to get start time from timestamp string (HH:MM:SS) ---
  const formatStartTime = (timestamp?: string): string => {
    if (!timestamp || !timestamp.includes('-->')) {
      return '--:--:--';
    }
    const startTimeStr = timestamp.split('-->')[0].trim();
    // Remove milliseconds
    return startTimeStr.split('.')[0]; 
  };

  // --- MODIFIED Handler for Confirming Problem Area --- 
  const handleConfirmToggle = async (problemArea: ProblemArea) => {
    // For confirmed problem areas, let the popover handle options instead of directly unconfirming
    if (!problemArea.is_confirmed) {
      // If unconfirmed, open the priority selection popover
      openPrioritySelector(problemArea);
    }
    // For confirmed items, we'll just open the popover with options
  };

  // Handler for unconfirming a problem area
  const handleUnconfirmProblemArea = async (problemAreaId: string) => {
    setConfirmingProblemId(problemAreaId); // Show loader on the icon
    setPriorityPopoverOpen(false); // Close popover
    
    try {
      // Pass null for priority when unconfirming
      const result = await confirmProblemArea(problemAreaId, false, null); 
      if (result.status === 'success' && result.data) {
        handleProblemAreaSaveSuccess(result.data); // Update state via shared handler
        toast.success(`Problem area unconfirmed.`);
      } else {
        toast.error(result.message || 'Failed to unconfirm problem area.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      setConfirmingProblemId(null); // Clear loader
      setSelectingPriorityForPA(null); // Clear temporary state
    }
  };

  // Handler to switch to priority selection mode
  const handleReselectPriority = (problemArea: ProblemArea) => {
    setSelectedPriority(problemArea.priority ?? null); // Pre-select current priority
    setSelectingPriorityForPA({...problemArea, is_confirmed: false}); // Use modified state to show priority selection UI
  };

  // --- NEW Handlers for Priority Selection Popover ---
  const openPrioritySelector = (problemArea: ProblemArea) => {
    setSelectingPriorityForPA(problemArea); // Store the PA being confirmed
    setSelectedPriority(null); // Start with no priority selected
    setPriorityPopoverOpen(true);
  };

  const handlePriorityPopoverOpenChange = (open: boolean) => {
    setPriorityPopoverOpen(open);
    if (!open) {
      // Reset state if popover is closed without confirming
      setSelectingPriorityForPA(null);
      setSelectedPriority(null);
    }
  };

  const handleConfirmPriority = async () => {
    if (!selectingPriorityForPA) return;

    const problemAreaId = selectingPriorityForPA.id;
    // Treat internal 'NONE' value as null for the API
    const priorityToSave = selectedPriority === 'NONE' ? null : selectedPriority;

    setConfirmingProblemId(problemAreaId); // Show loader
    setPriorityPopoverOpen(false); // Close popover

    try {
        // API call includes isConfirmed: true and the selected priority (or null)
        const result = await confirmProblemArea(problemAreaId, true, priorityToSave);
        if (result.status === 'success' && result.data) {
            handleProblemAreaSaveSuccess(result.data); // Update state
            toast.success(`Problem area confirmed with priority: ${priorityToSave || 'None'}.`);
        } else {
            toast.error(result.message || 'Failed to confirm problem area.');
        }
    } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
        setConfirmingProblemId(null); // Clear loader
        setSelectingPriorityForPA(null); // Clear temporary state
        setSelectedPriority(null);
    }
  };

  // --- NEW Handlers for Editing Problem Area --- 
  const handleEditProblemArea = (problemArea: ProblemArea) => {
    setEditingProblemArea(problemArea);
    setShowEditProblemAreaModal(true);
  };

  const handleProblemAreaSaveSuccess = (updatedProblemArea: ProblemArea) => {
    // Update state immutably
    setInterview(prevInterview => {
      if (!prevInterview || !prevInterview.problemAreas) return prevInterview;
      return {
        ...prevInterview,
        problemAreas: prevInterview.problemAreas.map(pa => 
          pa.id === updatedProblemArea.id ? updatedProblemArea : pa
        )
      };
    });
    setShowEditProblemAreaModal(false);
    setEditingProblemArea(null);
    toast.success("Problem area updated successfully.");
  };

  const handleEditModalClose = () => {
     setShowEditProblemAreaModal(false);
     setEditingProblemArea(null);
  }

  // --- NEW Handler for Deleting Problem Area --- 
  const handleDeleteProblemArea = (problemArea: ProblemArea) => {
    setDeletingProblemAreaInfo({ id: problemArea.id, title: problemArea.title });
    // The dialog component controls its own open state via onOpenChange
  };

  // --- NEW Handler for Confirming Problem Area Deletion --- 
  const handleConfirmPADelete = async () => {
    if (!deletingProblemAreaInfo) return;

    setIsProcessingPADelete(true);
    try {
      const result = await deleteProblemArea(deletingProblemAreaInfo.id);
      if (result.status === 'success') {
        setInterview(prevInterview => {
          if (!prevInterview || !prevInterview.problemAreas) return prevInterview;
          return {
            ...prevInterview,
            problemAreas: prevInterview.problemAreas.filter(pa => pa.id !== deletingProblemAreaInfo.id)
          };
        });
        toast.success(`Problem area "${deletingProblemAreaInfo.title}" deleted.`);
        setDeletingProblemAreaInfo(null); // Close dialog on success
      } else {
        toast.error(result.message || 'Failed to delete problem area.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An unknown error occurred during deletion.');
    } finally {
       setIsProcessingPADelete(false);
    }
  };

  // --- Inline Editing Handlers for Problem Areas ---

  // Store original data on focus (REMOVED - Relying on state lookup during save)
  // const handleProblemAreaFocus = (event: React.FocusEvent<HTMLDivElement>, problemArea: ProblemArea) => { ... };

  // Debounced save function for Problem Areas (Modified to get original value from state)
  const debouncedProblemAreaSave = useCallback((problemAreaId: string, field: 'title' | 'description', newValue: string) => {
    if (problemAreaSaveTimeoutRef.current) {
      clearTimeout(problemAreaSaveTimeoutRef.current);
    }
    problemAreaSaveTimeoutRef.current = setTimeout(async () => {
        const trimmedValue = newValue.trim();
        
        // Find the original value from the current interview state
        const currentProblemArea = interview?.problemAreas?.find(p => p.id === problemAreaId);
        if (!currentProblemArea) {
            console.error(`Cannot save: Original problem area ${problemAreaId} not found in state.`);
            toast.error("Error saving: Could not find original data.");
            return;
        }
        const originalValue = field === 'title' ? currentProblemArea.title : currentProblemArea.description;

        // Skip save if value is empty or unchanged
        if (!trimmedValue || trimmedValue === originalValue.trim()) {
            console.log(`[page.tsx] Problem Area ${field} unchanged or empty, skipping save.`);
            // If value became empty, revert it visually before returning
            const targetElement = document.getElementById(`problem-${problemAreaId}`)?.querySelector(`[aria-label='${field}']`);
            if (!trimmedValue && targetElement) {
                 (targetElement as HTMLElement).innerText = originalValue; 
            }
            return;
        }
        
        console.log(`[page.tsx] Saving Problem Area ${problemAreaId} - Field: ${field}, Value: ${trimmedValue}`);
        const updatePayload = { [field]: trimmedValue };

        try {
            const result = await updateProblemArea(problemAreaId, updatePayload);
            if (result.status === 'success' && result.data) {
                handleProblemAreaSaveSuccess(result.data); 
                toast.success(`Problem area ${field} updated.`);
            } else {
                toast.error(result.message || `Failed to update problem area ${field}.`);
                // Revert the display on error
                const targetElement = document.getElementById(`problem-${problemAreaId}`)?.querySelector(`[aria-label='${field}']`);
                if (targetElement) {
                    (targetElement as HTMLElement).innerText = originalValue;
                }
            }
        } catch (error) {
             toast.error(error instanceof Error ? error.message : `An unknown error occurred saving ${field}.`);
             // Revert the display on error
             const targetElement = document.getElementById(`problem-${problemAreaId}`)?.querySelector(`[aria-label='${field}']`);
             if (targetElement) {
                 (targetElement as HTMLElement).innerText = originalValue;
             }
        }
    }, 1500); 
  }, [interview]); // Depend on interview state to get original values

  // Handle blur - trigger save
  const handleProblemAreaBlur = (event: React.FocusEvent<HTMLDivElement>, problemArea: ProblemArea, field: 'title' | 'description') => {
    const currentValue = event.currentTarget.innerText || "";
    // Always trigger debounced save on blur
    debouncedProblemAreaSave(problemArea.id, field, currentValue);
  };

  // Handle Enter/Escape keys
  const handleProblemAreaKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, problemArea: ProblemArea, field: 'title' | 'description') => {
    if (event.key === 'Enter') {
      event.preventDefault(); 
      event.currentTarget.blur(); // Trigger blur to save
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      // Revert to original text from state and blur
      const currentProblemArea = interview?.problemAreas?.find(p => p.id === problemArea.id);
      const originalValue = field === 'title' ? currentProblemArea?.title : currentProblemArea?.description;
      event.currentTarget.innerText = originalValue || ''; // Revert to original or empty string
      
      if (problemAreaSaveTimeoutRef.current) { // Clear any pending save on escape
        clearTimeout(problemAreaSaveTimeoutRef.current);
      }
      event.currentTarget.blur();
    }
  };

  // --- End Inline Editing Handlers ---

  if (status === "loading" || (isLoading && !interview)) { // Adjusted loading state
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading interview analysis...</p>
        </div>
      </div>
    )
  }

  if (error || !interview) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/10 p-6 rounded-lg max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-2">Error Loading Interview</h2>
          <p className="text-muted-foreground mb-4">{error || "Interview not found"}</p>
          <Button variant="default" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // --- Data Extraction (Updated) --- 
  // Extract problemAreas directly from interview state
  const problemAreas: ProblemArea[] = interview?.problemAreas ?? [];
  // Extract transcript and synthesis from analysis_data (assuming analysis_data: any is re-added)
  const transcript: TranscriptChunk[] = interview?.analysis_data?.transcript ?? [];
  const synthesis = interview?.analysis_data?.synthesis ?? "";
  
  // Toggle search mode
  const toggleSearch = () => {
    setIsSearching(!isSearching)
    if (!isSearching) {
      // Focus the search input when opening
      setTimeout(() => {
        document.getElementById('transcript-search')?.focus()
      }, 100)
    } else {
      // Clear search when closing
      setSearchQuery("")
    }
  }

  // Search filter for transcript
  const filteredTranscript = searchQuery.trim() === "" 
    ? transcript 
    : transcript.filter((chunk: TranscriptChunk) => 
        chunk.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chunk.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chunk.chunk_number.toString().includes(searchQuery)
      );

  // Render the problem areas content (Updated Confirm Button & Priority Badge)
  const renderProblemAreas = () => (
    <div className="space-y-5 px-4">
      {problemAreas.length > 0 ? (
        problemAreas.map((problemArea, index) => (
          <Card 
            key={problemArea.id} 
            id={`problem-${problemArea.id}`} 
            className={cn(
              "border-l-4 shadow-sm transition-all",
              problemArea.is_confirmed ? "border-green-500 bg-green-50/30" : "border-primary/70"
            )}
          >
            <CardHeader className="p-3">
              <div className="flex items-center gap-3">
                 {/* --- Section 1: Confirmation Button & Priority Popover --- */}
                 <Popover open={priorityPopoverOpen && selectingPriorityForPA?.id === problemArea.id} onOpenChange={handlePriorityPopoverOpenChange}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <PopoverTrigger asChild>
                          <TooltipTrigger asChild>
                            {/* Confirmation/Priority Button */} 
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                // Base styles
                                "h-8 px-2 flex items-center gap-1 rounded-full transition-all border", // Reduced gap to 1
                                // Conditional Styles
                                problemArea.is_confirmed
                                  ? problemArea.priority // Confirmed: Check priority
                                    ? problemArea.priority === 'L' ? "bg-red-500/10 text-red-700 border-red-200 hover:bg-red-500/20" // L
                                    : problemArea.priority === 'M' ? "bg-yellow-500/10 text-yellow-700 border-yellow-200 hover:bg-yellow-500/20" // M
                                    : problemArea.priority === 'S' ? "bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-500/20" // S
                                    : "bg-muted/10 text-muted-foreground border-muted-200" // Fallback for unknown priority
                                    : "bg-muted/10 text-muted-foreground border-muted-200" // Confirmed, No Priority ('NA' style)
                                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/20" // Not Confirmed
                              )}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (problemArea.is_confirmed) {
                                  setSelectingPriorityForPA(problemArea);
                                  setPriorityPopoverOpen(true);
                                } else {
                                  handleConfirmToggle(problemArea);
                                }
                              }}
                              disabled={confirmingProblemId === problemArea.id}
                            >
                              {confirmingProblemId === problemArea.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                // Button Content Logic
                                <>
                                  {problemArea.is_confirmed ? (
                                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <Circle className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  {/* Show text only if confirmed */}
                                  {problemArea.is_confirmed && (
                                    // Changed ml-0.5 to ml-px
                                    <span className="text-xs font-medium ml-px">
                                      {/* Inner span with fixed width for text (16px) */}
                                      <span className="inline-block w-4 text-center"> {/* Changed w-3 back to w-4 */} 
                                        {problemArea.priority || "NA"} 
                                      </span>
                                    </span>
                                  )}
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                        </PopoverTrigger>
                        <TooltipContent side="left" className="text-xs">
                          <p>{problemArea.is_confirmed ? 'Change confirmation/priority' : 'Click to confirm and set priority'}</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Popover Content - Conditionally render based on confirmation status */}
                      {selectingPriorityForPA && (
                        <PopoverContent className="w-52 p-4" align="start">
                          {!selectingPriorityForPA.is_confirmed || (selectingPriorityForPA.id === problemArea.id && !problemArea.is_confirmed) ? (
                            // Priority Selection UI for unconfirmed problem areas
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-medium mb-1.5">Priority Level</h4>
                                <p className="text-xs text-muted-foreground">Select the importance of this problem area.</p>
              </div>
                              
                              <div className="flex gap-2 justify-between">
                                {priorityOptions.map(option => (
                                  <Button
                                    key={option.value}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      "flex-1 h-8 font-medium border",
                                      option.value === 'L' ? "bg-red-500/15 text-red-700 border-red-200 hover:bg-red-500/25" : "",
                                      option.value === 'M' ? "bg-yellow-500/15 text-yellow-700 border-yellow-200 hover:bg-yellow-500/25" : "",
                                      option.value === 'S' ? "bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/25" : ""
                                    )}
                                    onClick={() => {
                                      if (selectingPriorityForPA) {
                                        const problemAreaId = selectingPriorityForPA.id;
                                        setConfirmingProblemId(problemAreaId);
                                        setPriorityPopoverOpen(false);
                                        
                                        confirmProblemArea(problemAreaId, true, option.value)
                                          .then(result => {
                                            if (result.status === 'success' && result.data) {
                                              handleProblemAreaSaveSuccess(result.data);
                                              toast.success(`Problem area confirmed with priority: ${option.value}.`);
                                            } else {
                                              toast.error(result.message || 'Failed to confirm problem area.');
                                            }
                                          })
                                          .catch(error => {
                                            toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
                                          })
                                          .finally(() => {
                                            setConfirmingProblemId(null);
                                            setSelectingPriorityForPA(null);
                                            setSelectedPriority(null);
                                          });
                                      }
                                    }}
                                  >
                                    {option.value}
                                    <span className="sr-only">{option.label}</span>
                                  </Button>
                                ))}
                              </div>
                              
                              {/* No Priority Button - Add border */}
                              <Button
                                size="sm"
                                variant="ghost"
                                // Merged className attribute
                                className="w-full justify-center text-xs h-8 border border-muted hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                  // If we have a problem area context, confirm it with no priority
                                  if (selectingPriorityForPA) {
                                    const problemAreaId = selectingPriorityForPA.id;
                                    setConfirmingProblemId(problemAreaId);
                                    setPriorityPopoverOpen(false);
                                    
                                    // Directly call the API with null priority
                                    confirmProblemArea(problemAreaId, true, null)
                                      .then(result => {
                                        if (result.status === 'success' && result.data) {
                                          handleProblemAreaSaveSuccess(result.data);
                                          toast.success('Problem area confirmed with no priority.');
                                        } else {
                                          toast.error(result.message || 'Failed to confirm problem area.');
                                        }
                                      })
                                      .catch(error => {
                                        toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
                                      })
                                      .finally(() => {
                                        setConfirmingProblemId(null);
                                        setSelectingPriorityForPA(null);
                                        setSelectedPriority(null);
                                      });
                                  }
                                }}
                                disabled={confirmingProblemId === problemArea.id}
                              >
                                {confirmingProblemId === problemArea.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'No Priority'
                                )}
                              </Button>
                            </div>
                          ) : (
                            // Options UI for confirmed problem areas
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-medium mb-1.5">Confirmed Problem Area</h4>
                                <p className="text-xs text-muted-foreground">What would you like to do?</p>
                              </div>
                              
                              <div className="flex flex-col gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full justify-center h-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 border-muted"
                                  onClick={() => handleUnconfirmProblemArea(problemArea.id)}
                                  disabled={confirmingProblemId === problemArea.id}
                                >
                                  {confirmingProblemId === problemArea.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Unconfirm"
                                  )}
                                </Button>
                                
                                <Button
                                  size="sm"
                                  variant="outline" 
                                  className="w-full justify-center h-8 text-primary/80 hover:text-primary hover:bg-primary/10 border-muted"
                                  onClick={() => handleReselectPriority(problemArea)}
                                >
                                  Change Priority
                                </Button>
                              </div>
                            </div>
                          )}
                        </PopoverContent>
                      )}
                    </TooltipProvider>
                  </Popover>
                 
                 {/* --- Section 2: Title and Description (Inline Editable) --- */}
                 <div className="flex-grow min-w-0"> 
                   <CardTitle className="text-base font-medium text-foreground/90">
                     <div 
                         contentEditable
                         suppressContentEditableWarning={true}
                         onFocus={(e) => handleProblemAreaBlur(e, problemArea, 'title')}
                         onBlur={(e) => handleProblemAreaBlur(e, problemArea, 'title')}
                         onKeyDown={(e) => handleProblemAreaKeyDown(e, problemArea, 'title')}
                         className="outline-none focus:outline-none focus:ring-0 rounded-sm px-1 -mx-1 hover:bg-muted/40"
                         aria-label='title'
                     >
                         {problemArea.title} 
                     </div>
                   </CardTitle>
                   <CardDescription className="mt-1 text-sm leading-relaxed text-muted-foreground/90">
                      <div
                         contentEditable
                         suppressContentEditableWarning={true}
                         onFocus={(e) => handleProblemAreaBlur(e, problemArea, 'description')}
                         onBlur={(e) => handleProblemAreaBlur(e, problemArea, 'description')}
                         onKeyDown={(e) => handleProblemAreaKeyDown(e, problemArea, 'description')}
                         className="outline-none focus:outline-none focus:ring-0 rounded-sm px-1 -mx-1 hover:bg-muted/40"
                         aria-label='description'
                     >
                       {problemArea.description}
                      </div>
              </CardDescription>
                 </div>
                 
                 {/* --- Section 3: Action Buttons (Delete, Expand) --- */}
                 <div className="flex items-center space-x-1 flex-shrink-0 ml-auto">
                    <TooltipProvider delayDuration={100}>
                       {/* Expand/Collapse Button */}
                       <Tooltip>
                         <TooltipTrigger asChild>
                            <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => toggleProblemExpansion(problemArea.id)}
                             className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
                           >
                             {expandedProblemIds.includes(problemArea.id) ? (
                               <ChevronUp className="h-5 w-5" /> 
                             ) : (
                               <ChevronDown className="h-5 w-5" /> 
                             )}
                              <span className="sr-only">Toggle Excerpts</span>
                           </Button>
                         </TooltipTrigger>
                          <TooltipContent side="bottom"><p>{expandedProblemIds.includes(problemArea.id) ? 'Hide' : 'Show'} Excerpts</p></TooltipContent>
                       </Tooltip>
                       {/* Delete Button Tooltip */}
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => handleDeleteProblemArea(problemArea)} // Pass whole object
                             className="h-8 w-8 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-full"
                             disabled={isProcessingPADelete} // Disable if any delete is processing
                           >
                             <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete Problem Area</span>
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent side="bottom"><p>Delete Problem Area</p></TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                  </div>
               </div>
            </CardHeader>

             {expandedProblemIds.includes(problemArea.id) && (
               <CardContent className="p-4 pt-2 border-t border-border/40 mt-3">
                 <h4 className="text-sm font-semibold mb-3 text-foreground/90">Supporting Excerpts</h4>
                 <div className="space-y-3">
                   {problemArea.excerpts && problemArea.excerpts.length > 0 ? (
                     problemArea.excerpts.map((excerpt) => { // Removed unused index 'i'
                       const excerptId = `excerpt-${excerpt.id}`;
                    const associatedChunk = transcript.find((c: TranscriptChunk) => c.chunk_number === excerpt.chunk_number);
                    const excerptTimestamp = formatStartTime(associatedChunk?.timestamp);
                    
                    return (
                         <Card key={excerpt.id} id={excerptId} className="bg-muted/40 border shadow-none">
                        <CardContent className="p-3">
                          <div className="flex flex-wrap gap-1 mb-2">
                               {excerpt.categories?.map((category: string, catIdx: number) => (
                              <Badge
                                key={catIdx}
                                   className={`text-xs font-medium ${
                                  category in categoryColors
                                    ? categoryColors[category as keyof typeof categoryColors]
                                       : "bg-gray-100 text-gray-800 border-gray-200"
                                }`}
                                variant="outline"
                              >
                                {category}
                              </Badge>
                            ))}
                          </div>
                             <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-sm mb-2 text-foreground/90">
                               &quot;{excerpt.quote}&quot;
                          </blockquote>
                             <p className="text-sm text-muted-foreground mb-2 leading-normal">
                               <span className="font-medium text-foreground/80">Insight:</span> {excerpt.insight}
                          </p>
                             {excerpt.chunk_number != null && (
                            <Button
                              variant="link"
                              size="sm"
                                 className="p-0 h-auto text-xs text-primary/90 hover:text-primary"
                              onClick={() => scrollToChunk(excerpt.chunk_number, excerptId)}
                            >
                              View in transcript ({excerptTimestamp})
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                     })
                   ) : (
                     <p className="text-sm text-muted-foreground text-center py-2">No supporting excerpts found for this problem area.</p>
                   )}
                </div>
              </CardContent>
            )}
          </Card>
        ))
      ) : (
        <div className="text-center py-10">
           <p className="text-muted-foreground">No problem areas identified or processed for this interview.</p>
        </div>
      )}
    </div>
  );

  // Render the transcript content
  const renderTranscript = () => (
    <div className="space-y-2 px-3 pt-2">
      {filteredTranscript.length > 0 ? (
        filteredTranscript.map((chunk: TranscriptChunk) => (
          <div
            key={chunk.chunk_number}
            ref={(el) => { chunkRefs.current[chunk.chunk_number] = el; }}
            className={cn(
              // Base styles including default hover
              "p-3 rounded-md transition-colors border border-border/40 hover:bg-muted/30 relative", 
              // Conditional styles for active chunk: override hover effect
              activeChunk === chunk.chunk_number 
                ? "bg-yellow-100/80 !border-yellow-300 hover:bg-yellow-100/80" // Keep yellow on hover
                : "" // No additional styles for non-active chunks (default hover applies)
            )}
            id={`chunk-${chunk.chunk_number}`}
          >
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0">
                <Avatar className="h-6 w-6 border border-border/40">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {chunk.speaker?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1"> {/* Use items-baseline for better alignment */}
                  <span className="font-medium text-sm text-foreground/90">{chunk.speaker}</span>
                  {/* Display timestamp directly, muted and monospaced */}
                  <span className="text-xs text-muted-foreground/80 font-mono tabular-nums">
                    {formatStartTime(chunk.timestamp)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{chunk.text}</p>
              </div>
            </div>
            
            {activeChunk === chunk.chunk_number && originatingElementId && (
              <Button 
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-7 px-2 text-xs bg-background/80 backdrop-blur-sm"
                onClick={scrollToOriginatingElement}
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Go Back
              </Button>
            )}
          </div>
        ))
      ) : searchQuery.trim() !== "" ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No matches found for "{searchQuery}"</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Transcript not available for this interview.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* == Homepage Header START == */}
      <div className="px-4 md:px-8 py-3.5 border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto">
          {/* Use Grid for more control over header layout */}
          <div className="grid grid-cols-3 items-center">
            {/* Left Side: Breadcrumb Navigation */}
            <div className="justify-self-start">
              <Breadcrumb
                items={
                  interview?.project_id
                    ? [
                        {
                          // Revert title back to string
                          title: interview.project?.name || "Project",
                          href: `/project/${interview.project_id}/prioritize`,
                        },
                        {
                          // Revert title back to string
                          title: interview.title || "Interview",
                          href: `/interview-analysis/${resolvedParams.id}`,
                          isCurrentPage: true,
                        },
                      ]
                    : [
                        {
                          // Revert title back to string
                          title: interview?.title || "Interview",
                          href: `/interview-analysis/${resolvedParams.id}`,
                          isCurrentPage: true,
                        },
                      ]
                }
              />
            </div>
            
            {/* Center: Logo/Title (optional, can leave empty or add breadcrumbs later) */}
            <div className="justify-self-center">
              {/* Can add breadcrumbs or keep logo link if desired */}
              {/* <Link href="/" className="flex items-center gap-2">
                <h1 className="text-lg font-semibold ...">Navi ProductForce</h1>
                <Badge variant="outline" ...>Beta</Badge>
              </Link> */}
            </div>
            
            {/* Right Side: Icons/User Menu */}
            <div className="flex items-center gap-4 justify-self-end">
                  <Button
                variant="ghost" 
                size="icon" 
                className="relative h-8 w-8 text-muted-foreground/70 hover:text-foreground"
                  >
                <Bell className="h-4 w-4" />
                  </Button>
                  
                  {/* Divider */}
                  <div className="h-5 w-px bg-border/50"></div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost" 
                        size="sm"
                        className="flex items-center gap-2 h-8 px-2 text-muted-foreground/80 hover:text-foreground"
                      >
                        <Avatar className="h-6 w-6 border border-border/40">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(session?.user?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden md:inline font-medium">{session?.user?.name || "User"}</span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-56"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DropdownMenuLabel className="text-muted-foreground/80">My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem className="gap-3">
                          <User className="h-4 w-4" />
                          <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-3">
                          <Settings className="h-4 w-4" />
                          <span>Settings</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                        className="gap-3 text-red-500 focus:text-red-500"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
      {/* == Homepage Header END == */}

      {/* == Main Content Area == */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 md:px-6 py-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Title and Core Info Section */}
              <div className="space-y-4">
                {/* Title Row with Actions Dropdown - Reverted Title Structure */}
                <div className="flex items-center justify-between gap-4">
                    {/* Title with Edit - Legacy Structure & Styling */}
                    <div className="flex-1 relative">
                    <h1 
                      ref={titleRef} 
                      contentEditable
                      suppressContentEditableWarning={true} 
                      onInput={handleTitleInput} 
                      onBlur={handleTitleBlur} 
                      onKeyDown={handleTitleKeyDown} 
                            className="text-xl font-semibold tracking-tight px-1 cursor-text outline-none transition-colors hover:bg-muted/40 rounded-sm" // Legacy classes
                    >
                      {currentTitle}
                    </h1>
                    {saveError && (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger className="absolute right-0 top-1/2 -translate-y-1/2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Failed to save title</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  
                    {/* More Actions Dropdown (Kept separate) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onSelect={(e) => {
                          e.preventDefault();
                          setShowDeleteConfirm(true);
                        }}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Interview</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Two-Column Layout for Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-[4fr,1fr] gap-4">
                  {/* Left Column: Interview Details */}
                  <div className="space-y-5">
                    {/* Basic Interview Info */}
                    <div className="flex flex-wrap gap-2">
                      {interview?.participants && (
                        <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground/90">
                          <Users className="h-3.5 w-3.5" />
                          <span>{interview.participants}</span>
                        </div>
                      )}
                      {interview?.created_at && (
                        <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground/90">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>{formatDate(interview.created_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Summary with Left Border */}
                    <div className="prose prose-sm max-w-none border-l-2 border-primary/20 pl-4 py-1">
                      <div className="text-sm leading-relaxed text-foreground space-y-3">
                        {typeof synthesis === 'string' ? synthesis : synthesis.background}
                      </div>
                      
                      {/* Next Steps */}
                      {typeof synthesis !== 'string' && synthesis.next_steps && synthesis.next_steps.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-border/40">
                          <h4 className="text-sm font-medium mb-3">Next Steps</h4>
                          <ul className="space-y-2.5">
                            {synthesis.next_steps.map((step: string, index: number) => (
                              <li key={index} className="flex items-start gap-2.5 text-sm">
                                <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                                  <Check className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span className="flex-1">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Classification */}
                  <div className="space-y-4">
                    {/* Project Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground/90">Project</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowChangeProjectModal(true)}
                          className="h-6 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </Button>
                      </div>
                      {interview?.project_id ? (
                        <Link href={`/project/${interview.project_id}/prioritize`}>
                          <div 
                            className="rounded-sm px-2.5 py-1.5 cursor-pointer transition-colors text-sm border bg-muted/40 border-muted/50 text-foreground hover:bg-muted/60"
                          >
                            {projects.find(p => p.id === interview?.project_id)?.name || "No project assigned"}
                          </div>
                        </Link>
                      ) : (
                        <div 
                          className="rounded-sm px-2.5 py-1.5 cursor-pointer transition-colors text-sm border bg-muted/40 border-muted/50 text-muted-foreground hover:bg-muted/60"
                          onClick={() => setShowChangeProjectModal(true)}
                        >
                          No project assigned
                        </div>
                      )}
                    </div>

                    {/* Personas Section - Updated */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground/90">Personas</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => { // Fetch personas on demand when clicking Edit
                            setIsLoadingPersonas(true);
                            setPersonasError(null);
                            try {
                                const response = await getAllPersonas();
                                if (response.status === 'success') {
                                  setAllPersonas(response.data || []);
                                  setShowPersonaModal(true);
                                } else {
                                  setPersonasError(response.message || 'Failed to load personas');
                                  toast.error(response.message || 'Failed to load personas');
                                }
                            } catch (err: any) {
                                  setPersonasError(err.message || 'Error fetching personas');
                                  toast.error(err.message || 'Error fetching personas');
                            } finally {
                               setIsLoadingPersonas(false);
                            }
                          }}
                          className="h-6 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          disabled={isLoadingPersonas}
                        >
                          {isLoadingPersonas ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Edit"
                          )}
                        </Button>
                      </div>
                      
                      {/* Use interview.personas array of Persona objects */}
                      {interview?.personas && interview.personas.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {/* Map over Persona objects */}
                          {interview.personas.map((persona: Persona) => { 
                            // Get the color info object based on the stored identifier
                            const colorInfo = getPersonaColorById(persona.color);
                            return (
                              <Badge 
                                key={persona.id} 
                                className={cn(
                                  "text-sm py-0.5 px-2 h-6 transition-colors font-normal rounded-sm border", // Base styles
                                  "max-w-xs", // Keep max-width on the badge itself
                                  // Non-hovered state classes
                                  colorInfo.bg, 
                                  colorInfo.text, 
                                  colorInfo.border,
                                  // Explicitly define hover state to match non-hovered state
                                  `hover:${colorInfo.bg}`, 
                                  `hover:${colorInfo.text}`
                                )}
                              >
                                {/* Wrap name in span and apply truncation here */}
                                <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                  {persona.name} 
                                </span>
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <div 
                          className="rounded-md px-3 py-2 text-sm text-muted-foreground bg-muted/60 cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => setShowPersonaModal(true)}
                        >
                          No personas assigned
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs Section */}
              <section>
                <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex justify-start">
                      <TabsList className="w-auto">
                        <TabsTrigger value="problems">Problem Areas</TabsTrigger>
                        <TabsTrigger value="transcript">Transcript</TabsTrigger>
                      </TabsList>
                    </div>
                  </div>
                  {/* Adjusted Card Titles and Descriptions */} 
                  <div className="flex-1 overflow-visible">
                    <TabsContent value="problems" className="h-full overflow-visible mt-0 pt-0">
                      {/* New container structure with description above and connected content below */}
                      <div className="flex flex-col h-full shadow-sm rounded-lg border border-border/40 bg-background">
                        {/* Description container with rounded top corners */}
                        <div className="bg-card rounded-t-lg px-6 py-3">
                          <p className="text-sm text-muted-foreground/90">
                            Key issues identified from the interview
                          </p>
                        </div>
                        
                        {/* Separator line */}
                        <div className="h-px bg-border/40 w-full"></div>
                        
                        {/* Main content - no top rounded corners, connected to description */}
                        <div className="flex-1 rounded-b-lg bg-card overflow-hidden">
                          <ScrollArea className="h-full">
                            <div className="py-4">
                              {renderProblemAreas()}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="transcript" className="h-full overflow-visible mt-0 pt-0">
                      {/* New container structure with description above and connected content below */}
                      <div className="flex flex-col h-full shadow-sm rounded-lg border border-border/40 bg-background">
                        {/* Description container with rounded top corners */}
                        <div className="bg-card rounded-t-lg px-6 py-3">
                          <p className="text-sm text-muted-foreground/90">
                            Full transcript of the interview conversation
                          </p>
                        </div>
                        
                        {/* Separator line */}
                        <div className="h-px bg-border/40 w-full"></div>
                        
                        {/* Main content - no top rounded corners, connected to description */}
                        <div className="flex-1 rounded-b-lg bg-card overflow-hidden">
                          <ScrollArea className="h-full">
                            <div className="py-3">
                              {renderTranscript()}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </section>
            </div> {/* End max-w-7xl */} 
          </div> {/* End padding div */} 
        </ScrollArea> {/* End main ScrollArea */} 
      </div> {/* End flex-1 div */} 

      {/* == Persona Tagging Modal == */} 
      {interview && (
         <PersonaTaggingModal
            open={showPersonaModal}
            // Use the new handler for open/change
            onOpenChange={handlePersonaModalOpenChange} 
            interviewId={resolvedParams.id}
            initialPersonas={interview?.personas || []} 
            allPersonas={allPersonas} 
            onSaveSuccess={handlePersonaSaveSuccess}
            // Use the modified delete handler
            onDeleteSuccess={handlePersonaDeleteSuccess}
            // Derive the prop directly from interview state
            isInitialTagging={!interview?.personas || interview.personas.length === 0}
          />
      )}
      {/* Display loading indicator for personas if needed */} 
      {isLoadingPersonas && (
          <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
      )}
      
      {/* == Change Project Modal == */}
      {interview && (
        <ChangeProjectModal
          isOpen={showChangeProjectModal}
          onOpenChange={setShowChangeProjectModal}
          interviewId={resolvedParams.id}
          currentProjectId={interview?.project_id}
          onProjectChanged={handleProjectChangeSuccess}
        />
      )}
      
      {/* Use the new Single Delete Confirmation Dialog Component */}
      <SingleDeleteConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteInterview}
        itemName={interview?.title || 'this interview'} // Pass item name
        itemType="interview" // Specify item type
        isDeleting={isDeletingInterview}
      />

      {/* Edit Problem Area Modal */} 
      {showEditProblemAreaModal && editingProblemArea && (
          <EditProblemAreaModal 
              isOpen={showEditProblemAreaModal}
              onClose={handleEditModalClose}
              problemArea={editingProblemArea}
              onSaveSuccess={handleProblemAreaSaveSuccess}
          />
      )}
      
      {/* NEW Delete Problem Area Confirmation Dialog */} 
      <DeleteProblemAreaConfirmationDialog
        open={!!deletingProblemAreaInfo} // Dialog is open if info is not null
        onOpenChange={(open) => {
          if (!open) { // If dialog is closed (e.g., via Cancel or overlay click)
            setDeletingProblemAreaInfo(null);
            setIsProcessingPADelete(false); // Ensure loading state is reset
          }
          // Note: We don't need to explicitly set open state here, 
          // the parent controls it via deletingProblemAreaInfo
        }}
        onConfirm={handleConfirmPADelete} // Pass the confirmation handler
        problemAreaTitle={deletingProblemAreaInfo?.title || ''} // Pass title
        isDeleting={isProcessingPADelete} // Pass loading state
      />

    </div> // End root div
  )
} 