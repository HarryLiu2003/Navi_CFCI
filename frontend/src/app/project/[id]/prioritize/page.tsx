"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { toast } from 'sonner'
import {
  getProjectById,
  getProjectProblemAreas,
  getProjectInterviews,
  getInterviewById, 
  confirmProblemArea, 
  deleteProblemArea,
  updateProject, // <-- Import updateProject
  deleteProject, // <-- Import deleteProject
  Project,
  Interview,
  ProblemArea,
  Persona,
  Excerpt,
  ProjectDetailResponse,
  ProjectProblemAreasResponse,
  ProjectInterviewsResponse
} from '@/lib/api';
import { cn } from "@/lib/utils";
import { getPersonaColorById } from '@/lib/constants';
import { UploadTranscriptModal } from '@/components/dialogs/UploadTranscriptModal'; 
import { DeleteProblemAreaConfirmationDialog } from '@/components/dialogs/DeleteProblemAreaConfirmationDialog';
import { EditProjectDialog } from '@/components/dialogs/EditProjectDialog'; // <-- Import EditProjectDialog
import { DeleteProjectConfirmationDialog } from '@/components/dialogs/DeleteProjectConfirmationDialog'; // <-- Import DeleteProjectConfirmationDialog
// --- ADD DND Kit imports back --- 
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Shadcn UI & Lucide Icons
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChevronLeft,
  List,
  X,
  Filter,
  ArrowUpDown,
  Loader2,
  CalendarIcon,
  Search,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  Undo2,
  ExternalLink,
  ChevronRight,
  Bell,
  User,
  Settings, // <-- Import Settings icon
  Edit,     // <-- Import Edit icon
  Trash2,   // <-- Import Trash2 icon
  LogOut,
  MoreVertical,
  MoreHorizontal,
  GripVertical,
  ArrowDown,
  ArrowUp,
  Plus,
  FileText,
  HelpCircle,
  CalendarDays,
  Users,
  ChevronsLeft,
  ChevronsRight,
  Check,
} from 'lucide-react'
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb"

// === Add Imports for Batch Delete ===
import { Checkbox } from "@/components/ui/checkbox";
import { BatchDeleteConfirmationDialog } from '@/components/dialogs/BatchDeleteConfirmationDialog';
import { deleteInterview } from '@/lib/api'; // Ensure deleteInterview is imported if not already
// === End Imports ===

// --- Types ---
// Combined type for problem areas with interview context
interface ProblemAreaWithInterviewContext extends ProblemArea {
  interview: {
    id: string;
    title: string;
    personas: Persona[];
  }
}

// Type for the detail panel state
interface DetailPanelData {
  problemArea: ProblemAreaWithInterviewContext;
  fullInterview?: Interview | null; // Full interview data for transcript
  loadingInterview: boolean;
}

// --- NEW Sorting State ---
interface SortCriterion {
  id: string; // Unique key for dnd-kit, can be same as field
  field: 'title' | 'created_at' | 'priority'; // Add more fields as needed
  label: string;
  direction: 'asc' | 'desc';
}

const availableSortFields: Omit<SortCriterion, 'direction' | 'id'>[] = [
  { field: 'created_at', label: 'Date Created' },
  { field: 'priority', label: 'Priority' },
  // Add other potential sort fields here (e.g., 'description', 'persona_count')
];

// Helper for priority comparison
const priorityOrder: { [key: string]: number } = {
  'L': 3,
  'M': 2,
  'S': 1,
};

// --- Custom Month Picker Component ---
function MonthPicker({
  selected,
  onSelect,
}: {
  selected: Date | undefined
  onSelect: (date: Date | undefined) => void
}) {
  const [currentDate, setCurrentDate] = useState(selected || new Date())

  // Navigate to previous year
  const prevYear = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1))
  }

  // Navigate to next year
  const nextYear = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1))
  }

  // Get all months for the current year
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]

  // Check if a month is selected
  const isSelected = (month: number) => {
    return selected && selected.getMonth() === month && selected.getFullYear() === currentDate.getFullYear()
  }

  // Handle month selection
  const handleSelectMonth = (month: number) => {
    const newDate = new Date(currentDate.getFullYear(), month, 1)
    onSelect(newDate)
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={prevYear}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-medium">{currentDate.getFullYear()}</div>
        <Button variant="outline" size="icon" onClick={nextYear}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {months.map((month, index) => (
          <Button
            key={month}
            variant={isSelected(index) ? "default" : "outline"}
            className={`h-9 ${isSelected(index) ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => handleSelectMonth(index)}
          >
            {month.substring(0, 3)}
          </Button>
        ))}
      </div>
    </div>
  )
}

// --- Helper Functions ---
const getInitials = (name?: string | null): string => {
  if (!name || name.trim().length === 0) return "?"
  return name.trim()[0].toUpperCase();
}

const formatDate = (dateString: string | undefined | null, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'N/A';
  const defaultOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', options ?? defaultOptions);
  } catch (e) {
    return 'Invalid date';
  }
}

const getPriorityBadgeClass = (priority: string | null | undefined): string => {
  switch (priority) {
    case 'L': return "bg-red-500/20 text-red-700 border-red-200";
    case 'M': return "bg-yellow-500/20 text-yellow-700 border-yellow-200";
    case 'S': return "bg-blue-500/20 text-blue-700 border-blue-200";
    default: return "bg-muted/50 text-muted-foreground border-border/40"; // Default style for no priority
  }
};

// Format start time from transcript chunk timestamp
const formatStartTime = (timestamp?: string): string => {
    if (!timestamp || !timestamp.includes('-->')) {
      return '--:--:--';
    }
    const startTimeStr = timestamp.split('-->')[0].trim();
    // Remove milliseconds if present
    return startTimeStr.split('.')[0];
};

// Define category colors for consistency
const categoryColors = {
  "Current Approach": "bg-blue-100 text-blue-800 border-blue-200",
  "Pain Point": "bg-red-100 text-red-800 border-red-200",
  "Ideal Solution": "bg-green-100 text-green-800 border-green-200",
  "Impact": "bg-purple-100 text-purple-800 border-purple-200"
} as const;

// --- Global CSS to remove focus highlighting ---
const tabsListStyles = {
  focus: {
    outline: 'none',
    boxShadow: 'none',
  }
};

// --- Main Component ---
export default function ProjectPrioritizationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const projectId = params.id as string;

  // --- State Variables --- 
  const [project, setProject] = useState<Project | null>(null);
  const [problemAreas, setProblemAreas] = useState<ProblemAreaWithInterviewContext[]>([]);
  const [projectInterviews, setProjectInterviews] = useState<Interview[]>([]);
  const [allPersonasInProject, setAllPersonasInProject] = useState<Persona[]>([]); // For filtering

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering State
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Panel State
  const [isInterviewsPanelOpen, setIsInterviewsPanelOpen] = useState(false);
  const [detailPanelData, setDetailPanelData] = useState<DetailPanelData | null>(null);

  // Detail Panel Transcript State
  const [activeChunk, setActiveChunk] = useState<number | null>(null);
  const chunkRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [originatingElementId, setOriginatingElementId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState('details');

  // Add state for Delete Confirmation Dialog
  const [deletingProblemAreaInfo, setDeletingProblemAreaInfo] = useState<{ id: string; title: string } | null>(null);
  const [isProcessingPADelete, setIsProcessingPADelete] = useState(false);

  // Priority selection state
  const [selectingPriorityForPA, setSelectingPriorityForPA] = useState<ProblemArea | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  // Re-add states that were accidentally removed
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [confirmingProblemId, setConfirmingProblemId] = useState<string | null>(null);

  // --- State for Sheet Batch Delete ---
  const [selectedSheetInterviewIds, setSelectedSheetInterviewIds] = useState<Set<string>>(new Set());
  const [isSheetBatchDeleteConfirmOpen, setIsSheetBatchDeleteConfirmOpen] = useState(false);
  const [isSheetBatchDeleting, setIsSheetBatchDeleting] = useState(false);

  // New state just for detail panel actions
  const [detailPanelActionsOpen, setDetailPanelActionsOpen] = useState(false);

  // Priority options (aligned with interview-analysis page)
  const priorityOptions = [
    { value: 'L', label: 'Large Impact' },
    { value: 'M', label: 'Medium Impact' },
    { value: 'S', label: 'Small Impact' }
  ];

  // --- NEW Sorting State ---
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const [showCriteriaSelection, setShowCriteriaSelection] = useState(false);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- NEW state for Editing Problem Area --- 
  const [editingProblemArea, setEditingProblemArea] = useState<ProblemArea | null>(null);
  const [showEditProblemAreaModal, setShowEditProblemAreaModal] = useState(false);
  
  // --- State for Upload Transcript Modal ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // --- NEW state for Inline Editing ---

  // --- NEW State for Project Edit/Delete ---
  const [isProjectSettingsPopoverOpen, setIsProjectSettingsPopoverOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deletingProjectInfo, setDeletingProjectInfo] = useState<{ id: string; name: string } | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated" && projectId) {
      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        setProject(null);
        setProblemAreas([]);
        setProjectInterviews([]);
        setAllPersonasInProject([]);

        try {
          const [projectRes, problemAreasRes, interviewsRes] = await Promise.allSettled([
            getProjectById(projectId),
            getProjectProblemAreas(projectId),
            getProjectInterviews(projectId)
          ]);

          let fetchError: string | null = null;

          if (projectRes.status === 'fulfilled' && projectRes.value.status === 'success') {
            setProject(projectRes.value.data || null);
          } else {
            const message = projectRes.status === 'fulfilled' ? projectRes.value.message : projectRes.reason?.message;
            fetchError = `Project: ${message || 'Failed to load'}`;
            setProject(null);
          }

          if (problemAreasRes.status === 'fulfilled' && problemAreasRes.value.status === 'success') {
            const areas = problemAreasRes.value.data?.problemAreas || [];
            setProblemAreas(areas);
            const uniquePersonas = new Map<string, Persona>();
            areas.forEach(pa => pa.interview.personas?.forEach(p => uniquePersonas.set(p.id, p)));
            setAllPersonasInProject(Array.from(uniquePersonas.values()));
          } else {
            const message = problemAreasRes.status === 'fulfilled' ? problemAreasRes.value.message : problemAreasRes.reason?.message;
            fetchError = `${fetchError ? fetchError + '\n' : ''}Problem Areas: ${message || 'Failed to load'}`;
            setProblemAreas([]);
            setAllPersonasInProject([]);
          }

          if (interviewsRes.status === 'fulfilled' && interviewsRes.value.status === 'success') {
            setProjectInterviews(interviewsRes.value.data?.interviews || []);
          } else {
            const message = interviewsRes.status === 'fulfilled' ? interviewsRes.value.message : interviewsRes.reason?.message;
            fetchError = `${fetchError ? fetchError + '\n' : ''}Interviews: ${message || 'Failed to load'}`;
            setProjectInterviews([]);
          }

          if (fetchError) {
            setError(fetchError); // Keep raw error in state for potential detailed view
            toast.error("Failed to load some project data.", { description: "Please check console or try again later." });
          }

        } catch (err) {
          console.error("Unexpected error fetching project data:", err);
          const message = err instanceof Error ? err.message : "An unknown error occurred.";
          setError(message);
          toast.error("An unexpected error occurred.", { description: message });
          setProject(null);
          setProblemAreas([]);
          setProjectInterviews([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [projectId, status, router]);

  // --- Update Memoized Filtering/Sorting Logic ---
  const filteredAndSortedProblemAreas = useMemo(() => {
    // Start with confirmed problem areas
    let filtered = problemAreas.filter(pa => pa.is_confirmed === true);

    // Apply user-selected filters
    if (searchTerm.trim()) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(pa =>
            pa.title.toLowerCase().includes(lowerSearchTerm) ||
            pa.description.toLowerCase().includes(lowerSearchTerm)
        );
    }

    if (selectedMonth) {
      filtered = filtered.filter(pa => {
        try {
          const paDate = new Date(pa.created_at);
          if (isNaN(paDate.getTime())) return false;
          return paDate.getMonth() === selectedMonth.getMonth() && 
                 paDate.getFullYear() === selectedMonth.getFullYear();
        } catch { return false; }
      });
    }

    if (selectedPersonaIds.size > 0) {
      filtered = filtered.filter(pa =>
        pa.interview.personas?.some(p => selectedPersonaIds.has(p.id))
      );
    }

    if (selectedPriorities.size > 0) {
      filtered = filtered.filter(pa =>
        selectedPriorities.has(pa.priority || 'NONE')
      );
    }

    // Apply sorting if criteria exist
    if (sortCriteria.length > 0) {
      // Create a mutable copy for sorting
      const sorted = [...filtered]; 
      sorted.sort((a, b) => {
        for (const criterion of sortCriteria) {
          const { field, direction } = criterion;
          let comparison = 0;
          const valA = a[field as keyof ProblemAreaWithInterviewContext];
          const valB = b[field as keyof ProblemAreaWithInterviewContext];

          if (field === 'priority') {
            const priorityA = priorityOrder[valA as string ?? 'NONE'] ?? 0;
            const priorityB = priorityOrder[valB as string ?? 'NONE'] ?? 0;
            comparison = priorityA - priorityB;
          } else if (field === 'created_at') {
            // Compare YYYY-MM-DD strings to ignore time
            try {
              const dateA = new Date(valA as string);
              const dateB = new Date(valB as string);
              // Format to YYYY-MM-DD for comparison
              const dateStrA = `${dateA.getFullYear()}-${(dateA.getMonth() + 1).toString().padStart(2, '0')}-${dateA.getDate().toString().padStart(2, '0')}`;
              const dateStrB = `${dateB.getFullYear()}-${(dateB.getMonth() + 1).toString().padStart(2, '0')}-${dateB.getDate().toString().padStart(2, '0')}`;
              comparison = dateStrA.localeCompare(dateStrB);
            } catch (e) {
              // Handle potential errors during date parsing/formatting
              comparison = 0; 
            }
          } else if (field === 'title') {
            comparison = (valA as string ?? '').localeCompare(valB as string ?? '');
          } // Add more field type comparisons if needed
          
          if (comparison !== 0) {
            return direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0; // Items are equal based on all criteria
      });
      // Return the sorted array
      return sorted; 
    }

    // Return the filtered (but not sorted) array if no criteria
    return filtered;
  }, [problemAreas, searchTerm, selectedMonth, selectedPersonaIds, selectedPriorities, sortCriteria]);

  // --- NEW Sorting Handlers ---
  const handleAddSortClick = () => {
    setShowCriteriaSelection(true);
  };

  const handleSelectCriterion = (field: SortCriterion['field'], label: string) => {
    setSortCriteria(prev => [
      { id: field + Date.now(), field, label, direction: 'desc' },
      ...prev
    ]);
    setShowCriteriaSelection(false);
  };

  const handleToggleDirection = (id: string) => {
    setSortCriteria(prev => prev.map(criterion => 
      criterion.id === id 
        ? { ...criterion, direction: criterion.direction === 'asc' ? 'desc' : 'asc' } 
        : criterion
    ));
  };

  const handleRemoveCriterion = (id: string) => {
    setSortCriteria(prev => prev.filter(criterion => criterion.id !== id));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSortCriteria((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // --- Handlers ---
  const handlePersonaFilterChange = (personaId: string) => {
    setSelectedPersonaIds(prev => {
      const next = new Set(prev);
      if (next.has(personaId)) { next.delete(personaId); } else { next.add(personaId); }
      return next;
    });
  }

  const handlePriorityFilterChange = (priorityValue: string) => {
     setSelectedPriorities(prev => {
      const next = new Set(prev);
      if (next.has(priorityValue)) { next.delete(priorityValue); } else { next.add(priorityValue); }
      return next;
    });
  }

  const clearAllFilters = () => {
      setSearchTerm("");
      setSelectedMonth(undefined);
      setSelectedPersonaIds(new Set());
      setSelectedPriorities(new Set());
  };

  // Fetch full interview data when opening the detail panel
  const handleProblemAreaClick = async (problemArea: ProblemAreaWithInterviewContext) => {
      setActiveChunk(null);
      setOriginatingElementId(null);
      setActiveDetailTab('details');

      setDetailPanelData({
          problemArea: problemArea,
          fullInterview: null,
          loadingInterview: true,
      });

      try {
          console.log(`[PrioritizePage] Fetching full interview: ${problemArea.interview.id}`);
          const interviewRes = await getInterviewById(problemArea.interview.id);
          if (interviewRes.status === 'success' && interviewRes.data) {
              console.log(`[PrioritizePage] Full interview fetched successfully.`);
              setDetailPanelData(prev => prev ? ({
                  ...prev,
                  fullInterview: interviewRes.data,
                  loadingInterview: false,
              }) : null);
          } else {
              throw new Error(interviewRes.message || "Failed to load interview transcript data.");
          }
      } catch (err) {
          toast.error(`Error loading transcript: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setDetailPanelData(prev => prev ? ({ ...prev, loadingInterview: false }) : null);
      }
  };

  const closeDetailPanel = () => {
      setDetailPanelData(null);
      setActiveChunk(null);
      setOriginatingElementId(null);
  };

  const scrollToChunk = (chunkNumber: number, triggerElementId: string | null = null) => {
    setOriginatingElementId(triggerElementId);
    setActiveChunk(chunkNumber);
    setActiveDetailTab('transcript');

    setTimeout(() => {
      const targetChunk = chunkRefs.current[chunkNumber];
      if (targetChunk) {
        targetChunk.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        console.warn(`Chunk ref ${chunkNumber} not found for scrolling.`);
      }
    }, 100);
  };

  const scrollToOriginatingElement = () => {
    if (!originatingElementId) return;
    setActiveDetailTab('details');

    setTimeout(() => {
        const element = document.getElementById(originatingElementId);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
             element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
            setTimeout(() => {
                element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-1000');
            }, 1500);
        }
        setOriginatingElementId(null);
    }, 100);
  };

  // Function to set state needed to open the popover for a specific PA
  const handleOpenActionsPopover = (problemArea: ProblemAreaWithInterviewContext) => {
    setSelectingPriorityForPA(problemArea); // Set which PA is selected
    setPriorityPopoverOpen(true);        // Set the flag to open the popover
  };

  // Handles closing the popover (e.g., clicking outside)
  const handlePopoverOpenChange = (open: boolean) => {
    setPriorityPopoverOpen(open);
    if (!open) {
      // Reset the selected PA when the popover closes
      setSelectingPriorityForPA(null);
    }
  };

  // Handle priority selection and confirmation
  const handlePrioritySelect = (priority: string) => {
    if (selectingPriorityForPA) {
      const problemAreaId = selectingPriorityForPA.id;
      setConfirmingProblemId(problemAreaId);
      setPriorityPopoverOpen(false); // Close popover immediately when action starts
      
      confirmProblemArea(problemAreaId, true, priority)
        .then(result => {
          if (result.status === 'success' && result.data) {
            setProblemAreas(prev => prev.map(pa => 
              pa.id === problemAreaId 
                ? { ...pa, priority: priority }
                : pa
            ));
            toast.success(`Priority updated to: ${priority}`);
      } else {
            toast.error(result.message || 'Failed to update priority');
          }
        })
        .catch(error => {
          toast.error(error instanceof Error ? error.message : 'An unknown error occurred');
        })
        .finally(() => {
          setConfirmingProblemId(null);
        });
    }
  };

  // Handle clearing priority
  const handleClearPriority = () => {
    if (selectingPriorityForPA) {
      const problemAreaId = selectingPriorityForPA.id;
      setConfirmingProblemId(problemAreaId);
      setPriorityPopoverOpen(false); // Close popover immediately when action starts

      confirmProblemArea(problemAreaId, true, null)
        .then(result => {
          if (result.status === 'success' && result.data) {
            setProblemAreas(prev => prev.map(pa => 
              pa.id === problemAreaId 
                ? { ...pa, priority: null }
                : pa
            ));
            toast.success('Priority cleared');
    } else {
            toast.error(result.message || 'Failed to clear priority');
          }
        })
        .catch(error => {
          toast.error(error instanceof Error ? error.message : 'An unknown error occurred');
        })
        .finally(() => {
          setConfirmingProblemId(null);
        });
    }
  };

  // Handle unconfirming problem area
  const handleUnconfirmProblemArea = (problemAreaId: string) => {
    if (selectingPriorityForPA) { // Ensure we have the context
      setConfirmingProblemId(problemAreaId);
      setPriorityPopoverOpen(false); // Close popover immediately when action starts

      confirmProblemArea(problemAreaId, false, null)
        .then(result => {
          if (result.status === 'success') {
            setProblemAreas(prev => prev.filter(pa => pa.id !== problemAreaId));
            toast.success('Problem area unconfirmed successfully');
            // If we're viewing this problem in the detail panel, close it
            if (detailPanelData?.problemArea.id === problemAreaId) {
              closeDetailPanel();
            }
    } else {
            toast.error(result.message || 'Failed to unconfirm problem area');
          }
        })
        .catch(error => {
          console.error('Error unconfirming problem area:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to unconfirm problem area');
        })
        .finally(() => {
          setConfirmingProblemId(null);
        });
    }
  };

  // Modify existing handler: Trigger dialog instead of direct delete
  const handleDeleteProblemAreaFromPopover = () => {
    if (selectingPriorityForPA) {
      setDeletingProblemAreaInfo({ 
        id: selectingPriorityForPA.id, 
        title: selectingPriorityForPA.title 
      });
      setPriorityPopoverOpen(false); // Close the actions popover
    }
  };

  // NEW Handler: Performs delete after confirmation
  const handleConfirmPADelete = async () => {
    if (!deletingProblemAreaInfo) return;

    setIsProcessingPADelete(true);
    try {
      const result = await deleteProblemArea(deletingProblemAreaInfo.id);
      if (result.status === 'success') {
        setProblemAreas((prev) =>
          prev.filter((pa) => pa.id !== deletingProblemAreaInfo.id)
        );
        toast.success(`Problem area "${deletingProblemAreaInfo.title}" deleted.`);
        setDeletingProblemAreaInfo(null); // Close dialog on success
        
        // Close the detail panel if the deleted problem area is currently being viewed
        if (detailPanelData?.problemArea.id === deletingProblemAreaInfo.id) {
          closeDetailPanel();
        }
      } else {
        toast.error(result.message || "Failed to delete problem area.");
        // Consider keeping dialog open on error for context
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "An unknown error occurred during deletion."
      );
      // Consider keeping dialog open on error for context
    } finally {
      setIsProcessingPADelete(false);
    }
  };

  // --- NEW Project Edit/Delete Handlers ---
  const handleOpenEditProjectDialog = () => {
    setIsProjectSettingsPopoverOpen(false); // Close popover
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteProjectDialog = () => {
    if (project) {
      setIsProjectSettingsPopoverOpen(false); // Close popover
      setDeletingProjectInfo({ id: project.id, name: project.name });
    } else {
      toast.error("Project data not available to initiate deletion.");
    }
  };

  const handleSaveEditProject = async (updatedData: { name: string; description?: string | null }) => {
    if (!project) return; 
    // Note: isSaving state is handled within EditProjectDialog
    try {
      const result = await updateProject(project.id, updatedData);
      if (result.status === 'success' && result.data) {
        setProject(result.data); // Update local project state
        toast.success('Project updated successfully!');
        setIsEditDialogOpen(false); // Close dialog on success
      } else {
        throw new Error(result.message || 'Failed to update project');
      }
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error('Failed to save project', { description: error instanceof Error ? error.message : undefined });
      // Keep the dialog open on error so user can retry or see the error
      throw error; // Re-throw to let the dialog know saving failed
    }
  };

  const handleConfirmDeleteProject = async (force: boolean) => { // Accept force parameter
    if (!deletingProjectInfo) return;

    setIsDeletingProject(true);
    try {
      // Pass the force parameter to the API call
      const result = await deleteProject(deletingProjectInfo.id, force);

      if (result.status === 'success') {
        toast.success(`Project "${deletingProjectInfo.name}" deleted successfully.`);
        setDeletingProjectInfo(null); // Close dialog
        router.push('/'); // Redirect to homepage or project list page after deletion
      } else {
         // If force delete was attempted, show potentially different message
         if (force && result.message) {
            toast.error('Force Delete Failed', { description: result.message || 'An unknown error occurred during force deletion.' });
         } else if (result.status === 'error' && result.message?.includes('contains interviews')) {
            // Handle standard 409: Tell user to use force delete or remove interviews
            toast.error('Cannot Delete Project', { 
              description: result.message || 'Project still contains interviews. Use force delete or remove/reassign them first.'
            });
         } else {
            // Handle other errors
            toast.error('Failed to delete project', { description: result.message || 'An unknown error occurred.' });
         }
         // Keep dialog open on standard conflict error (409-like message) or if force delete fails
         if (result.status === 'error' && (force || result.message?.includes('contains interviews'))) {
           // Keep dialog open if force delete failed OR if it's the standard 'contains interviews' error
         } else {
            setDeletingProjectInfo(null); // Close dialog for other errors
         }
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error('Failed to delete project', { description: error instanceof Error ? error.message : 'An unknown network error occurred.' });
      // Keep dialog open on catch block error
    } finally {
      setIsDeletingProject(false);
    }
  };

  // --- NEW Sheet Batch Delete Logic ---
  const handleSheetRowCheckboxChange = (checked: boolean | 'indeterminate', interviewId: string) => {
    setSelectedSheetInterviewIds(prev => {
      const newSet = new Set(prev);
      if (checked === true) {
        newSet.add(interviewId);
      } else {
        newSet.delete(interviewId);
      }
      return newSet;
    });
  };

  const handleSheetHeaderCheckboxChange = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedSheetInterviewIds(new Set(projectInterviews.map(i => i.id)));
    } else {
      setSelectedSheetInterviewIds(new Set());
    }
  };

  const getSheetHeaderCheckboxState = () => {
    const visibleIds = new Set(projectInterviews.map(i => i.id));
    if (visibleIds.size === 0) return false; // Handle case where projectInterviews is empty
    const selectedVisibleCount = Array.from(selectedSheetInterviewIds).filter(id => visibleIds.has(id)).length;
    
    if (selectedVisibleCount === 0) {
      return false;
    } else if (selectedVisibleCount === visibleIds.size) {
      return true;
    } else {
      return 'indeterminate';
    }
  };

  const handleSheetBatchDeleteConfirm = async () => {
    setIsSheetBatchDeleting(true);
    const idsToDelete = Array.from(selectedSheetInterviewIds);
    let successCount = 0;
    let failCount = 0;

    const results = await Promise.allSettled(
      idsToDelete.map(id => deleteInterview(id))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 'success') {
        successCount++;
      } else {
        failCount++;
        const interviewId = idsToDelete[index];
        const interviewTitle = projectInterviews.find(i => i.id === interviewId)?.title || interviewId;
        const errorMessage = (result.status === 'rejected') 
          ? result.reason?.message 
          : (result.value as any)?.message || 'Unknown error';
        console.error(`Failed to delete interview ${interviewTitle} (${interviewId}) from sheet: ${errorMessage}`);
      }
    });

    if (successCount > 0) {
      toast.success(`${successCount} interview${successCount > 1 ? 's' : ''} deleted successfully.`);
      // Update the local state for the sheet
      setProjectInterviews(prev => prev.filter(interview => !selectedSheetInterviewIds.has(interview.id)));
      // TODO: Consider if problem areas need refreshing here if any deleted interview was the last source for a PA
    }
    if (failCount > 0) {
      toast.error(`${failCount} interview${failCount > 1 ? 's' : ''} could not be deleted. See console for details.`);
    }

    setSelectedSheetInterviewIds(new Set());
    setIsSheetBatchDeleteConfirmOpen(false);
    setIsSheetBatchDeleting(false);
  };
  // --- End Sheet Batch Delete Logic ---

  // --- NEW Sortable Item Component ---
  function SortableItem({ id, criterion, onToggleDirection, onRemove }: { id: string; criterion: SortCriterion; onToggleDirection: (id: string) => void; onRemove: (id: string) => void; }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div ref={setNodeRef} style={style} className="flex items-center justify-between bg-muted/40 p-2 rounded hover:bg-muted/60 text-sm">
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <span {...attributes} {...listeners} className="cursor-grab touch-none p-1">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </span>
          <span className="font-medium truncate flex-1" title={criterion.label}>{criterion.label}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleDirection(id)}>
            {criterion.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            <span className="sr-only">Toggle sort direction</span>
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-muted-foreground/50 hover:text-destructive" onClick={() => onRemove(id)}>
          <X className="h-4 w-4" />
          <span className="sr-only">Remove sort criterion</span>
        </Button>
      </div>
    );
  }

  // --- Loading State ---
  if (status === "loading" || (isLoading && !project)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        {/* Aligned Spinner Style */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading project data...</p>
      </div>
    );
  }

  // --- Unauthenticated Check ---
  if (status !== "authenticated") {
     return null; // Redirect handled by useEffect
  }

  // --- Render Functions for Panels ---

  // Render Interviews Panel Content (Left Sheet)
  const renderInterviewsPanelContent = () => {
    // Calculate header checkbox state within the render function
    const sheetHeaderCheckboxState = getSheetHeaderCheckboxState();
    
    return (
    <>
      <SheetHeader className="px-0 py-0 border-b"> {/* Remove default padding */} 
        {/* === Add Flex container for Header === */}
        <div className="flex justify-between items-center space-y-0 px-4 h-16"> {/* Fixed height like homepage */}
           {/* Left Side: Checkbox & Title/Desc */}
          <div className="flex items-center gap-3">
             <Checkbox
                id="select-all-sheet-interviews"
                checked={sheetHeaderCheckboxState}
                onCheckedChange={handleSheetHeaderCheckboxChange}
                aria-label="Select all interviews in sheet"
                disabled={projectInterviews.length === 0}
                className={projectInterviews.length === 0 ? 'opacity-50' : ''}
              />
            <div>
              <SheetTitle className="text-lg font-semibold tracking-tight">Interviews</SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground/70 mt-1">
                {projectInterviews.length} interview{projectInterviews.length !== 1 ? 's' : ''} in "{project?.name}"
              </SheetDescription>
            </div>
          </div>
          {/* Right Side: Delete Button */}
          <div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                 if (selectedSheetInterviewIds.size > 0 && !isSheetBatchDeleting) {
                    setIsSheetBatchDeleteConfirmOpen(true);
                 }
              }}
              className={cn(
                  "h-8 w-8", 
                  selectedSheetInterviewIds.size > 0 
                    ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground/30 cursor-not-allowed"
              )}
              disabled={selectedSheetInterviewIds.size === 0 || isSheetBatchDeleting}
              aria-label="Delete selected interviews"
            >
              {isSheetBatchDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border/40">
            {projectInterviews.length > 0 ? (
              projectInterviews.map(interview => (
              // Add flex container for checkbox and content
              <div key={interview.id} className={cn("flex items-center gap-3 pr-4 pl-2 hover:bg-muted/40 transition-colors", selectedSheetInterviewIds.has(interview.id) ? 'bg-muted/50' : '')}> 
                 {/* Checkbox */}
                <div className="p-2 flex-shrink-0">
                  <Checkbox
                    id={`select-sheet-interview-${interview.id}`}
                    checked={selectedSheetInterviewIds.has(interview.id)}
                    onCheckedChange={(checked) => handleSheetRowCheckboxChange(checked, interview.id)}
                    aria-labelledby={`sheet-interview-title-${interview.id}`}
                  />
                </div>
                {/* Original Interview Content - Use flex-1 to take remaining space */}
                <Link 
                    href={`/interview-analysis/${interview.id}`} 
                    id={`sheet-interview-title-${interview.id}`} 
                    className="block py-3 flex-1 min-w-0" // Allow shrinking
                    onClick={() => setIsInterviewsPanelOpen(false)}
                >
                    <div className="space-y-1">
                        <p className="font-medium hover:text-primary hover:underline truncate">{interview.title}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" />
                                <span>{interview.participants || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" />
                                <span>{formatDate(interview.created_at, { month: 'short', day: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                </Link>
              </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No interviews assigned to this project yet.</p>
              </div>
            )}
        </div>
      </ScrollArea>
    </>
  )};

  // --- Main Page Return ---
  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Top Bar */}
      <div className="px-4 md:px-8 py-3.5 border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto">
          {/* Use Grid for more control over header layout */}
          <div className="grid grid-cols-3 items-center">
            {/* Left Side: Breadcrumb Navigation + Interviews Button */}
            <div className="justify-self-start flex items-center">
              <Breadcrumb
                items={[
                  {
                    title: project?.name || "Project", 
                    href: `/project/${projectId}/prioritize`,
                    isCurrentPage: true
                  }
                ]}
              />
              
              {/* Divider */}
              <div className="h-5 w-px bg-border/50 mx-4"></div>
              
              {/* Show Interviews Trigger */}
              <Sheet open={isInterviewsPanelOpen} onOpenChange={setIsInterviewsPanelOpen}>
                <SheetTrigger asChild>
                  <div 
                    className={cn(
                      "flex items-center gap-1.5 text-sm text-muted-foreground/80 hover:text-foreground cursor-pointer transition-colors py-1",
                      isInterviewsPanelOpen && "text-foreground"
                    )}
                  >
                    <List className="h-4 w-4" />
                    <span className="font-medium">{isLoading ? 'Interviews' : `${projectInterviews.length} Interviews`}</span>
                  </div>
                </SheetTrigger>
                <SheetContent 
                  side="left" 
                  className="w-full sm:max-w-2xl p-0 flex flex-col [&_button[aria-label='Close']]:hidden [&>button]:hidden"
                  onOpenAutoFocus={(e) => e.preventDefault()} // Prevent auto-focus on open
                >
                  {/* Wrap content and closer in a flex container */}
                  <div className="flex flex-1 min-h-0">
                    {/* Main Content Area (takes up most space) */} 
                    <div className="flex-1 flex flex-col">
                       {/* Call the existing render function which includes header and scroll area */}
                       {renderInterviewsPanelContent()} 
                    </div>
                    {/* Closer Button (on the right side for a left sheet) */} 
                    <div 
                      onClick={() => setIsInterviewsPanelOpen(false)}
                      className="w-12 flex items-center justify-center border-l border-border/40 hover:bg-muted/40 transition-colors cursor-pointer bg-muted/20"
                      role="button"
                      aria-label="Close panel"
                    >
                      <ChevronsLeft className="h-5 w-5 text-muted-foreground/70" />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            
            {/* Center: Empty or optional content */}
            <div className="justify-self-center">
              {/* Empty for now, could add content later if needed */}
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
                  onCloseAutoFocus={(e) => e.preventDefault()} // Prevent focus return on close
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
      {/* Main Content Area */} 
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 md:px-8 py-8">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Title Section */} 
              <section>
                {/* Project Title Container */} 
                <div className="mb-5 flex items-center bg-background/60 backdrop-blur-sm rounded-lg border border-border/30 px-6 py-4 shadow-sm relative overflow-hidden">
                  {/* Gradient background effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-primary/[0.05] to-transparent pointer-events-none"></div>
                  
                  {/* Content with relative positioning */} 
                  <div className="relative z-10 flex items-center justify-between flex-1">
                    <div className="flex items-center flex-1 min-w-0"> {/* Allow shrinking */} 
                      <h2 className="text-xl font-semibold tracking-tight text-foreground/90 truncate" title={project?.name}>{project?.name || "Project"}</h2>
                      <div className="h-5 mx-4 w-px bg-border/50 flex-shrink-0"></div>
                      {/* Display Project Description instead */}
                      <p className="text-sm text-muted-foreground max-w-2xl truncate" title={project?.description || ''}>
                        {project?.description || "No description available."}
                      </p>
                      
                      {/* --- Project Settings Popover --- */}
                      <div className="h-5 mx-4 w-px bg-border/50 flex-shrink-0"></div>
                      <Popover open={isProjectSettingsPopoverOpen} onOpenChange={setIsProjectSettingsPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground/60 hover:text-foreground flex-shrink-0"
                            aria-label="Project settings"
                           >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="start">
                          <Button 
                            variant="ghost"
                            className="w-full justify-start h-8 px-2 mb-1" 
                            onClick={handleOpenEditProjectDialog}
                           >
                            <Edit className="h-4 w-4 mr-2" /> Edit Project
                          </Button>
                          <Button 
                            variant="ghost"
                            className="w-full justify-start h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleOpenDeleteProjectDialog}
                           >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Project
                          </Button>
                        </PopoverContent>
                      </Popover>
                      {/* --- End Project Settings Popover --- */}
                      
                    </div>
                
                    {/* Interview action buttons */} 
                    <div className="flex items-center gap-4 flex-shrink-0"> {/* Prevent shrinking */} 
                      <div className="flex items-center text-sm px-3 py-1.5 bg-muted/30 rounded-md">
                        <button 
                          onClick={() => setIsInterviewsPanelOpen(true)} 
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center"
                        >
                          <List className="h-3.5 w-3.5 mr-1.5" />
                          <span>View Interviews</span>
                        </button>
                        <div className="h-4 w-px bg-border/30 mx-2"></div>
                        <button 
                          onClick={() => setIsUploadModalOpen(true)} 
                          className="text-primary/80 hover:text-primary transition-colors flex items-center"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          <span>Create New</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Redesigned Filter Controls */} 
                <div className="mb-5 bg-background/60 backdrop-blur-sm rounded-lg border border-border/30 shadow-sm relative overflow-hidden">
                  {/* Blue accent edge */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/80"></div>
                  
                  <div className="px-4 py-3 flex flex-wrap items-center gap-3 pl-6">{/* Added left padding to account for blue edge */}
                      {/* Search Input */}
                      <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                        <Input
                          id="search-problems"
                          placeholder="Search by title or description..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 bg-background border-border/40 hover:border-border/60 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                        />
                      </div>
                      
                      <div className="h-8 w-px bg-border/30 hidden md:block"></div>
                      
                      {/* Month Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left font-normal border-border/40 hover:border-border/60 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none",
                              !selectedMonth && "text-muted-foreground/70"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedMonth 
                              ? selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) 
                              : "Filter by month"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <MonthPicker selected={selectedMonth} onSelect={setSelectedMonth} />
                          {selectedMonth && (
                            <div className="p-3 border-t border-border/20">
                              <Button variant="ghost" size="sm" className="w-full focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none" onClick={() => setSelectedMonth(undefined)}>
                                Clear
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      
                      <div className="h-8 w-px bg-border/30 hidden md:block"></div>
                      
                      {/* Sort Popover */}
                      <Popover open={isSortPopoverOpen} onOpenChange={setIsSortPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="justify-start border-border/40 hover:border-border/60 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none">
                            <ArrowUpDown className="mr-2 h-4 w-4" />
                            <span className="flex items-center gap-1">
                              Sort
                              {sortCriteria.length > 0 && (
                                <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center">
                                  {sortCriteria.length}
                                </Badge>
                              )}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 border border-border/40 shadow-md" align="start">
                          {
                            showCriteriaSelection 
                            ? (
                              // --- Criteria Selection View ---
                              <div>
                                <div className="px-4 py-3 border-b border-border/20 flex items-center bg-muted/30">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 mr-2 hover:bg-background/80 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none" onClick={() => setShowCriteriaSelection(false)}>
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <h4 className="text-sm font-medium">Add Sort Field</h4>
                    </div>
                                <div className="py-1 max-h-[250px] overflow-y-auto">
                                  {
                                    availableSortFields
                                      .filter(fieldInfo => !sortCriteria.some(sc => sc.field === fieldInfo.field)) // Filter out already selected fields
                                      .map(fieldInfo => (
                                        <Button
                                          key={fieldInfo.field}
                                          variant="ghost"
                                          className="w-full justify-start h-9 px-4 text-sm hover:bg-muted/30 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                                          onClick={() => handleSelectCriterion(fieldInfo.field, fieldInfo.label)}
                                        >
                                          {fieldInfo.label}
                                        </Button>
                                    ))
                                  }
                                  {availableSortFields.every(fieldInfo => sortCriteria.some(sc => sc.field === fieldInfo.field)) && (
                                     <p className='text-xs text-muted-foreground text-center py-4'>All available fields added.</p>
                                  )}
                                </div>
                              </div>
                            )
                            : (
                              // --- Main Sort View ---
                              <div>
                                <div className="px-4 py-3 border-b border-border/20 bg-muted/30">
                                  <h4 className="text-sm font-medium">Sort Problem Areas</h4>
                                  <p className="text-xs text-muted-foreground mt-1">Drag to reorder priority. Click arrows to toggle direction.</p>
                                </div>
                                <ScrollArea className="max-h-[250px]">
                                  <div className="p-3 space-y-2">
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                      <SortableContext items={sortCriteria} strategy={verticalListSortingStrategy}>
                                        {sortCriteria.map(criterion => (
                                          <SortableItem key={criterion.id} id={criterion.id} criterion={criterion} onToggleDirection={handleToggleDirection} onRemove={handleRemoveCriterion} />
                                        ))}
                                      </SortableContext>
                                    </DndContext>
                                    {sortCriteria.length === 0 && (
                                      <p className='text-xs text-muted-foreground text-center p-4'>No sort criteria applied.</p>
                                    )}
                                  </div>
                                </ScrollArea>
                                {/* Add Sort Criteria Button */} 
                                <div className="p-3 border-t border-border/20 bg-muted/10">
                                  <Button
                                    variant="outline"
                                    className="w-full justify-center h-8 text-sm border-border/40 hover:border-border/60 bg-background focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                                    onClick={handleAddSortClick}
                                    disabled={availableSortFields.every(fieldInfo => sortCriteria.some(sc => sc.field === fieldInfo.field))} // Disable if all fields are used
                                  >
                                    <Plus className="h-4 w-4 mr-2" /> Add Sort Field
                                  </Button>
                                </div>
                              </div>
                            )
                          }
                        </PopoverContent>
                      </Popover>
                      
                      <div className="h-8 w-px bg-border/30 hidden md:block"></div>
                      
                      {/* Priority Filter Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="justify-start border-border/40 hover:border-border/60 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none">
                            <Filter className="mr-2 h-4 w-4" />
                            <span className="flex items-center gap-1">
                              Priority
                              {selectedPriorities.size > 0 && (
                                <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center">
                                  {selectedPriorities.size}
                                </Badge>
                              )}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="border border-border/40 shadow-md min-w-[220px]">
                          <div className="px-4 py-3 border-b border-border/20 bg-muted/30">
                            <h4 className="text-sm font-medium">Filter by Priority</h4>
                          </div>
                          <div className="py-1">
                            {[
                              { value: 'L', label: 'High Impact', bgClass: 'bg-red-500/20', textClass: 'text-red-700', borderClass: 'border-red-200' },
                              { value: 'M', label: 'Medium Impact', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-700', borderClass: 'border-yellow-200' },
                              { value: 'S', label: 'Low Impact', bgClass: 'bg-blue-500/20', textClass: 'text-blue-700', borderClass: 'border-blue-200' },
                              { value: 'NONE', label: 'No Priority', bgClass: 'bg-muted/10', textClass: 'text-muted-foreground', borderClass: 'border-muted-200' }
                            ].map((priority) => (
                              <div key={priority.value} className="px-2 py-1">
                                <div 
                                  className="flex items-center gap-3 px-2 py-1.5 text-sm rounded hover:bg-muted/30 cursor-pointer"
                                  onClick={() => handlePriorityFilterChange(priority.value)} 
                                >
                                  <div className={cn(
                                    "h-4 w-4 rounded-sm border flex items-center justify-center",
                                    selectedPriorities.has(priority.value) 
                                      ? "bg-primary border-primary text-primary-foreground" 
                                      : "border-border/60"
                                  )}>
                                    {selectedPriorities.has(priority.value) && <Check className="h-3 w-3" />}
                                  </div>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className={cn(
                                      "inline-flex items-center justify-center w-8 rounded-full py-1 text-xs font-medium border",
                                      priority.bgClass,
                                      priority.textClass,
                                      priority.borderClass
                                    )}>
                                      {priority.value === 'NONE' ? 'NA' : priority.value}
                                    </div>
                                    <span>{priority.label}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      <div className="h-8 w-px bg-border/30 hidden md:block"></div>

                      {/* Persona Filter Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="justify-start border-border/40 hover:border-border/60 transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none" disabled={allPersonasInProject.length === 0}>
                            <Users className="mr-2 h-4 w-4" />
                            <span className="flex items-center gap-1">
                              Persona
                              {selectedPersonaIds.size > 0 && (
                                <Badge variant="secondary" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center">
                                  {selectedPersonaIds.size}
                                </Badge>
                              )}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="border border-border/40 shadow-md min-w-[260px] max-h-[350px] overflow-y-auto">
                          <div className="px-4 py-3 border-b border-border/20 bg-muted/30 sticky top-0 z-10">
                            <h4 className="text-sm font-medium">Filter by Persona</h4>
                          </div>
                          <div className="py-1">
                          {allPersonasInProject.length > 0 ? (
                              allPersonasInProject.map(persona => {
                                const colorInfo = getPersonaColorById(persona.color);
                                return (
                                  <div key={persona.id} className="px-2 py-1">
                                    <div 
                                      className="flex items-center gap-3 px-2 py-1.5 text-sm rounded hover:bg-muted/30 cursor-pointer"
                                      onClick={() => handlePersonaFilterChange(persona.id)}
                                    >
                                      <div className={cn(
                                        "h-4 w-4 rounded-sm border flex items-center justify-center",
                                        selectedPersonaIds.has(persona.id) 
                                          ? "bg-primary border-primary text-primary-foreground" 
                                          : "border-border/60"
                                      )}>
                                        {selectedPersonaIds.has(persona.id) && <Check className="h-3 w-3" />}
                                      </div>
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Badge 
                                          className={cn(
                                            "text-sm py-0.5 px-2 h-6 transition-colors font-normal rounded-sm border", 
                                            colorInfo.bg, 
                                            colorInfo.text, 
                                            colorInfo.border,
                                            "hover:" + colorInfo.bg, 
                                            "hover:" + colorInfo.text
                                          )}
                                        >
                                          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                            {persona.name}
                                          </span>
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                No personas found in this project
                              </div>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Clear Filters Button - Only shown when filters applied */} 
                      {(searchTerm || selectedMonth || selectedPriorities.size > 0 || selectedPersonaIds.size > 0 || sortCriteria.length > 0) && (
                        <>
                          <div className="h-8 w-px bg-border/30 hidden md:block"></div>
                          <Button 
                            variant="ghost" 
                            onClick={() => { clearAllFilters(); setSortCriteria([]); }} 
                            className="h-9 text-muted-foreground px-3 border border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                          >
                            <X className="h-4 w-4 mr-1.5"/> Clear all
                        </Button>
                        </>
                      )}
                  </div>
                    </div>

                {/* --- NEW Structure START --- */} 
                {/* Container mimicking interview page tabs structure */} 
                <div className="flex flex-col h-full shadow-sm rounded-lg border border-border/40 bg-background">
                   {/* Description header */} 
                   <div className="bg-card rounded-t-lg px-6 py-3">
                     <p className="text-sm text-muted-foreground/90">
                        Displaying confirmed problem areas in interviews
                     </p>
                   </div>
                   {/* Separator */} 
                   <div className="h-px bg-border/40 w-full"></div>
                   {/* Content Area (Moves existing Card content here) */}
                   <div className="flex-1 rounded-b-lg bg-card overflow-hidden">
                      {/* Remove original Card and CardContent wrappers */} 
                      {/* --- Table Header as Divs + Grid --- */}
                      <div className="border-b border-border/40 sticky top-0 z-10 bg-muted/30 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
                        {/* Grid definition: Added actions column */}
                        <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,3fr)_minmax(0,2fr)_auto] gap-0 items-center text-sm font-medium text-muted-foreground/90">
                          {/* Col 1: Problem Area Header - Remove sorting button */}
                          <div className="px-6 py-3.5 border-r border-border/20">
                            <span className="mr-1">Problem Area</span>
                          </div>
                          {/* Col 2: Description Header */}
                          <div className="px-6 py-3.5 border-r border-border/20">
                             Description
                          </div>
                          {/* Col 3: Personas Header */}
                          <div className="px-6 py-3.5 border-r border-border/20">
                             Persona
                          </div>
                          {/* Col 4: Date Header */}
                          <div className="px-6 py-3.5 border-r border-border/20">
                            <span className="mr-1">Date</span>
                          </div>
                          {/* Col 5: Actions Header */}
                          <div className="w-[48px] px-2 py-3.5 text-center">
                            <span className="sr-only">Actions</span>
                          </div>
                        </div>
                      </div>
                      {/* --- Table Body as Divs --- */}
                      <div className="relative min-h-[240px]"> {/* Added min-height */} 
                         {/* Loading State */} 
                         {isLoading ? (
                           <div className="absolute inset-0 flex items-center justify-center"> {/* Use absolute centering like homepage */} 
                             <div className="flex flex-col items-center justify-center space-y-2">
                               <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                               <p className="text-sm text-muted-foreground">Loading confirmed problem areas...</p>
                             </div>
                           </div>
                         ) : filteredAndSortedProblemAreas.length === 0 ? (
                            // Use absolute centering like homepage, remove py-12
                            <div className="absolute inset-0 flex items-center justify-center text-center px-6"> 
                              {/* Add padding to inner container if needed */} 
                              <div className="flex flex-col items-center justify-center py-6"> {/* Added py-6 here */} 
                                <div className="rounded-full bg-muted/30 p-4 mb-4">
                                  <HelpCircle className="h-8 w-8 text-primary/30" /> 
                                </div>
                                <h3 className="text-lg font-medium mb-2">
                                   {problemAreas.filter(pa => pa.is_confirmed).length === 0 
                                      ? "No Confirmed Problem Areas" 
                                      : "No Problem Areas Match Filters"
                                   }
                                </h3>
                                <p className="text-muted-foreground max-w-md mb-4">
                                  {problemAreas.filter(pa => pa.is_confirmed).length === 0
                                    ? "No problem areas have been confirmed for this project yet."
                                    : "Try adjusting your search or filter criteria."
                                  }
                                </p>
                                {(searchTerm || selectedMonth || selectedPriorities.size > 0 || selectedPersonaIds.size > 0 || sortCriteria.length > 0) && 
                                 (problemAreas.filter(pa => pa.is_confirmed).length > 0) && (
                                   <Button variant="outline" size="sm" onClick={() => { clearAllFilters(); setSortCriteria([]); }}>
                                     <X className="h-3.5 w-3.5 mr-1.5"/>
                                     Clear Filters & Sort
                                   </Button>
                                )}
                              </div>
                           </div>
                         ) : (
                            filteredAndSortedProblemAreas.map((pa) => (
                              <div key={pa.id} className={cn("grid grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,3fr)_minmax(0,2fr)_auto] gap-0 items-center", "hover:bg-muted/30 transition-colors group relative border-b border-border/20")}>
                                {/* Col 1: Problem Area (Name) + Priority Badge */}
                                <div 
                                  id={`problem-area-title-${pa.id}`}
                                  className="px-6 py-3.5 h-14 border-r border-border/20 overflow-x-auto scrollbar-thin flex items-center cursor-pointer"
                                  onClick={() => handleProblemAreaClick(pa)}
                                >
                                  <div className="whitespace-nowrap flex items-center gap-3">
                                    <span 
                                      className={cn(
                                        "inline-flex items-center justify-center w-8 rounded-full border py-1 text-xs font-medium flex-shrink-0",
                                        pa.priority === 'L' ? "bg-red-500/10 text-red-700 border-red-200" : "",
                                        pa.priority === 'M' ? "bg-yellow-500/10 text-yellow-700 border-yellow-200" : "",
                                        pa.priority === 'S' ? "bg-blue-500/10 text-blue-700 border-blue-200" : "",
                                        !pa.priority ? "bg-muted/10 text-muted-foreground border-muted-200" : ""
                                      )}
                                    >
                                      {confirmingProblemId === pa.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        pa.priority || 'NA'
                                      )}
                                    </span>
                                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate" title={pa.title}>{pa.title}</div>
                                  </div>
                                </div>
                                {/* Col 2: Description */}
                                <div 
                                  className="px-6 py-3.5 h-14 border-r border-border/20 overflow-x-auto scrollbar-thin flex items-center cursor-pointer"
                                  onClick={() => handleProblemAreaClick(pa)}
                                >
                                  <div className="whitespace-nowrap">
                                    <div className="text-sm text-muted-foreground/80 truncate" title={pa.description}>{pa.description}</div>
                                  </div>
                                </div>
                                {/* Col 3: Personas */}
                                <div 
                                  className="px-6 py-3.5 h-14 border-r border-border/20 flex items-center overflow-x-auto scrollbar-thin cursor-pointer"
                                  onClick={() => handleProblemAreaClick(pa)}
                                >
                                  {pa.interview.personas && pa.interview.personas.length > 0 ? (
                                    <div className="flex gap-1.5 whitespace-nowrap"> 
                                      {pa.interview.personas.map((p: Persona) => { 
                                        const colorInfo = getPersonaColorById(p.color);
                                        return (
                                          <Badge
                                            key={p.id}
                                            title={p.name}
                                            className={cn(
                                              "text-sm py-0.5 px-2 h-6 font-normal rounded-sm border flex-shrink-0",
                                              colorInfo.bg,
                                              colorInfo.text,
                                              colorInfo.border,
                                              `hover:${colorInfo.bg}`,
                                              `hover:${colorInfo.text}`
                                            )}
                                          >
                                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                              {p.name}
                                            </span>
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                                {/* Col 4: Date */}
                                <div 
                                  className="px-6 py-3.5 h-14 border-r border-border/20 flex items-center cursor-pointer"
                                  onClick={() => handleProblemAreaClick(pa)}
                                >
                                  <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                                    {formatDate(pa.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>
                                {/* Col 5: Actions Popover */}
                                <div className="w-[48px] px-2 py-3.5 h-14 flex items-center justify-center">
                                  <Popover 
                                    open={priorityPopoverOpen && selectingPriorityForPA?.id === pa.id} 
                                    onOpenChange={handlePopoverOpenChange} 
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
                                        onClick={() => handleOpenActionsPopover(pa)} 
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Open actions for {pa.title}</span>
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent 
                                      align="end" 
                                      sideOffset={5}
                                      className="w-52 p-4 z-50"
                                    >
                                      {selectingPriorityForPA && (
                                        <>
                                          {/* Change Priority Section - Remove explicit padding */}
                                          <div className="pb-2"> {/* Removed px-4 pt-4 */} 
                                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Change Priority</p>
                                            <div className="grid grid-cols-3 gap-2">
                                              {priorityOptions.map((option) => (
                                                <Button
                                                  key={option.value}
                                                  size="sm"
                                                  variant="outline" 
                                                  className={cn( 
                                                    "flex-1 h-8 font-medium border", 
                                                    option.value === 'L' ? "bg-red-500/15 text-red-700 border-red-200 hover:bg-red-500/25" : "",
                                                    option.value === 'M' ? "bg-yellow-500/15 text-yellow-700 border-yellow-200 hover:bg-yellow-500/25" : "",
                                                    option.value === 'S' ? "bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/25" : ""
                                                  )}
                                                  onClick={() => handlePrioritySelect(option.value)} 
                                                  disabled={confirmingProblemId === selectingPriorityForPA.id} 
                                                >
                                                  {option.value}
                                                  <span className="sr-only">{option.label}</span>
                                                </Button>
                                              ))}
                                            </div>
                                            {/* No Priority Button - Add border back */}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="w-full justify-center text-xs h-8 mt-2 border border-muted hover:bg-accent hover:text-accent-foreground"
                                              onClick={handleClearPriority} 
                                              disabled={confirmingProblemId === selectingPriorityForPA.id}
                                            >
                                              No Priority
                                            </Button>
                                          </div>

                                          <Separator className="my-2" />

                                          {/* Unconfirm and Delete Buttons - Remove explicit padding */} 
                                          <div className="flex flex-col"> {/* Removed px-4 pb-4 pt-2 */} 
                                             {/* Unconfirm Button */} 
                                             <Button
                                               variant="outline"
                                               size="sm"
                                               className="w-full justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 border-muted h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                                               onClick={() => handleUnconfirmProblemArea(selectingPriorityForPA.id)}
                                               disabled={confirmingProblemId === selectingPriorityForPA.id}
                                             >
                                               {confirmingProblemId === selectingPriorityForPA.id ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" /> 
                                                ) : (
                                                  "Unconfirm"
                                                )}
                                             </Button>
                                             {/* Delete Button - Keep mt-2 for spacing */} 
                                             <Button
                                               variant="outline"
                                               size="sm"
                                               className="w-full justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 border-muted h-8 mt-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                                               onClick={handleDeleteProblemAreaFromPopover}
                                               disabled={confirmingProblemId === selectingPriorityForPA.id}
                                             >
                                                {confirmingProblemId === selectingPriorityForPA.id ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  "Delete"
                                                )}
                                             </Button>
                                          </div>
                                        </>
                                      )}
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            ))
                          )}
                      </div> 
                   </div> { /* End content area */}
                </div> { /* End new structure */}
                {/* --- REMOVE Original Card that wrapped the table --- */}
                {/* <Card className="overflow-hidden border border-border/40"> */} 
                {/*   <CardContent className="p-0"> */} 
                {/*     {/* ... Table Header and Body were here ... */} 
                {/*   </CardContent> */} 
                {/* </Card> */} 
              </section>
            </div>
          </div>
        </ScrollArea>
      </div>

       {/* Left Interviews Panel - Ensure it calls the updated render function */}
       <Sheet open={isInterviewsPanelOpen} onOpenChange={setIsInterviewsPanelOpen}>
         <SheetContent 
           side="left" 
           className="w-full sm:max-w-2xl p-0 flex flex-col [&_button[aria-label='Close']]:hidden [&>button]:hidden"
           onOpenAutoFocus={(e) => e.preventDefault()} // Prevent auto-focus on open
         >
           {/* Wrap content and closer in a flex container */}
           <div className="flex flex-1 min-h-0">
             {/* Main Content Area (takes up most space) */} 
             <div className="flex-1 flex flex-col">
                {/* Call the existing render function which includes header and scroll area */}
                {renderInterviewsPanelContent()} 
             </div>
             {/* Closer Button (on the right side for a left sheet) */} 
             <div 
               onClick={() => setIsInterviewsPanelOpen(false)}
               className="w-12 flex items-center justify-center border-l border-border/40 hover:bg-muted/40 transition-colors cursor-pointer bg-muted/20"
               role="button"
               aria-label="Close panel"
             >
               <ChevronsLeft className="h-5 w-5 text-muted-foreground/70" />
             </div>
           </div>
         </SheetContent>
       </Sheet>

       {/* Right Detail Panel - Improved UI */}
       <Sheet open={!!detailPanelData} onOpenChange={(open: boolean) => !open && closeDetailPanel()}>
          <SheetContent side="right" className="w-full sm:max-w-4xl p-0 flex flex-col [&_button[aria-label='Close']]:hidden [&>button]:hidden">
            <div className="flex flex-1 min-h-0">
              <div 
                onClick={() => closeDetailPanel()}
                className="w-12 flex items-center justify-center border-r border-border/40 hover:bg-muted/40 transition-colors cursor-pointer bg-muted/20"
                role="button"
                aria-label="Close panel"
              >
                <ChevronsRight className="h-5 w-5 text-muted-foreground/70" />
              </div>
              <div className="flex-1 flex flex-col">
                {/* Replace function call with direct rendering */}
             <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex flex-col h-full">
                  <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <SheetHeader className="px-6 py-4 border-b space-y-4">
                      {detailPanelData && (
                        <>
                          {/* -- Section 1: Title, Description & Actions -- */}
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <SheetTitle className="text-xl font-semibold tracking-tight flex items-center gap-3 flex-1 min-w-0">
                                <span 
                                  className={cn(
                                    "inline-flex items-center justify-center w-8 rounded-full border py-1 text-xs font-medium flex-shrink-0", 
                                    detailPanelData.problemArea.priority === 'L' ? "bg-red-500/10 text-red-700 border-red-200" : "",
                                    detailPanelData.problemArea.priority === 'M' ? "bg-yellow-500/10 text-yellow-700 border-yellow-200" : "",
                                    detailPanelData.problemArea.priority === 'S' ? "bg-blue-500/10 text-blue-700 border-blue-200" : "",
                                    !detailPanelData.problemArea.priority ? "bg-muted/10 text-muted-foreground border-muted-200" : ""
                                  )}
                                >
                                  {confirmingProblemId === detailPanelData.problemArea.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    detailPanelData.problemArea.priority || 'NA'
                                  )}
                                </span>
                                <span className="truncate" title={detailPanelData.problemArea.title}>{detailPanelData.problemArea.title}</span>
                              </SheetTitle>
                              
                              {/* Dedicated popover for the sheet header */}
                              <Popover open={detailPanelActionsOpen} onOpenChange={setDetailPanelActionsOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground/60 hover:text-foreground flex-shrink-0 ml-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions for {detailPanelData.problemArea.title}</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" sideOffset={5} className="w-52 p-4 z-[100]">
                                  {/* Priority Controls */}
                                  <div className="pb-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Change Priority</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      {priorityOptions.map((option) => (
                                        <Button
                                          key={option.value}
                                          size="sm"
                                          variant="outline"
                                          className={cn(
                                            "flex-1 h-8 font-medium border focus-visible:ring-0 focus-visible:ring-offset-0",
                                            option.value === 'L' ? "bg-red-500/15 text-red-700 border-red-200 hover:bg-red-500/25" : "",
                                            option.value === 'M' ? "bg-yellow-500/15 text-yellow-700 border-yellow-200 hover:bg-yellow-500/25" : "",
                                            option.value === 'S' ? "bg-blue-500/15 text-blue-700 border-blue-200 hover:bg-blue-500/25" : ""
                                          )}
                                          onClick={() => {
                                            setConfirmingProblemId(detailPanelData.problemArea.id);
                                            setDetailPanelActionsOpen(false); // Close popover immediately
                                            confirmProblemArea(detailPanelData.problemArea.id, true, option.value)
                                              .then(result => {
                                                if (result.status === 'success' && result.data) {
                                                  // Update problemAreas state
                                                  setProblemAreas(prev => prev.map(pa =>
                                                    pa.id === detailPanelData.problemArea.id
                                                      ? { ...pa, priority: option.value }
                                                      : pa
                                                  ));
                                                  // Update detailPanelData state to reflect the change immediately
                                                  setDetailPanelData(prev => prev ? {
                                                    ...prev,
                                                    problemArea: {
                                                      ...prev.problemArea,
                                                      priority: option.value
                                                    }
                                                  } : null);
                                                  toast.success(`Priority updated to: ${option.value}`);
                                                } else {
                                                  toast.error(result.message || 'Failed to update priority');
                                                }
                                              })
                                              .catch(error => {
                                                toast.error(
                                                  error instanceof Error ? error.message : 'An unknown error occurred'
                                                );
                                              })
                                              .finally(() => {
                                                setConfirmingProblemId(null);
                                              });
                                          }}
                                          disabled={confirmingProblemId === detailPanelData.problemArea.id}
                                          tabIndex={0}
                                        >
                                          {option.value}
                                          <span className="sr-only">{option.label}</span>
                                        </Button>
                                      ))}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="w-full justify-center text-xs h-8 mt-2 border border-muted hover:bg-accent hover:text-accent-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                                      onClick={() => {
                                        setConfirmingProblemId(detailPanelData.problemArea.id);
                                        setDetailPanelActionsOpen(false); // Close popover immediately
                                        confirmProblemArea(detailPanelData.problemArea.id, true, null)
                                          .then(result => {
                                            if (result.status === 'success' && result.data) {
                                              // Update problemAreas state
                                              setProblemAreas(prev => prev.map(pa =>
                                                pa.id === detailPanelData.problemArea.id
                                                  ? { ...pa, priority: null }
                                                  : pa
                                              ));
                                              // Update detailPanelData state to reflect the change immediately
                                              setDetailPanelData(prev => prev ? {
                                                ...prev,
                                                problemArea: {
                                                  ...prev.problemArea,
                                                  priority: null
                                                }
                                              } : null);
                                              toast.success('Priority cleared');
                                            } else {
                                              toast.error(result.message || 'Failed to clear priority');
                                            }
                                          })
                                          .catch(error => {
                                            toast.error(
                                              error instanceof Error ? error.message : 'An unknown error occurred'
                                            );
                                          })
                                          .finally(() => {
                                            setConfirmingProblemId(null);
                                          });
                                      }}
                                      disabled={confirmingProblemId === detailPanelData.problemArea.id}
                                    >
                                      No Priority
                                    </Button>
                                  </div>

                                  <Separator className="my-2" />

                                  {/* Action Buttons */}
                                  <div className="flex flex-col">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 border-muted h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                                      onClick={() => {
                                        setConfirmingProblemId(detailPanelData.problemArea.id);
                                        setDetailPanelActionsOpen(false); // Close popover immediately
                                        confirmProblemArea(detailPanelData.problemArea.id, false, null)
                                          .then(result => {
                                            if (result.status === 'success') {
                                              setProblemAreas(prev => prev.filter(pa => pa.id !== detailPanelData.problemArea.id));
                                              toast.success('Problem area unconfirmed successfully');
                                              closeDetailPanel(); // Close the panel since we unconfirmed the problem
                                            } else {
                                              toast.error(result.message || 'Failed to unconfirm problem area');
                                            }
                                          })
                                          .catch(error => {
                                            toast.error(
                                              error instanceof Error ? error.message : 'Failed to unconfirm problem area'
                                            );
                                          })
                                          .finally(() => {
                                            setConfirmingProblemId(null);
                                          });
                                      }}
                                      disabled={confirmingProblemId === detailPanelData.problemArea.id}
                                    >
                                      {confirmingProblemId === detailPanelData.problemArea.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        "Unconfirm"
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full justify-center text-destructive/80 hover:text-destructive hover:bg-destructive/10 border-muted h-8 mt-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                                      onClick={() => {
                                        setDeletingProblemAreaInfo({
                                          id: detailPanelData.problemArea.id,
                                          title: detailPanelData.problemArea.title
                                        });
                                        setDetailPanelActionsOpen(false);
                                      }}
                                      disabled={confirmingProblemId === detailPanelData.problemArea.id}
                                    >
                                      {confirmingProblemId === detailPanelData.problemArea.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        "Delete"
                                      )}
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <Separator className="w-full" />

                            <SheetDescription className="text-sm text-muted-foreground/90 leading-relaxed">
                       {detailPanelData.problemArea.description}
                     </SheetDescription>
                          </div>

                          {/* -- Section 2: Metadata in Card -- */}
                          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                            {/* From Interview Link */}
                            {detailPanelData.problemArea.interview?.title && (
                              <div className="flex items-center text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground/70" />
                                  <span className="text-muted-foreground whitespace-nowrap">From interview:</span>
                                  <Link 
                                    href={`/interview-analysis/${detailPanelData.problemArea.interview.id}`}
                                    className="font-medium text-primary hover:underline truncate"
                                    title={detailPanelData.problemArea.interview.title}
                                  >
                                    {detailPanelData.problemArea.interview.title}
                                  </Link>
                                </div>
                              </div>
                            )}
                            
                            {/* Date & Personas Row */}
                            <div className="flex flex-wrap items-center gap-4">
                              {/* Date */}
                              <div className="flex items-center gap-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CalendarDays className="h-4 w-4 text-muted-foreground/70" />
                                  <span>{formatDate(detailPanelData.problemArea.created_at)}</span>
                                </div>
                              </div>

                              {/* Personas */}
                              {detailPanelData.problemArea.interview?.personas &&
                                detailPanelData.problemArea.interview.personas.length > 0 && (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Users className="h-4 w-4 text-muted-foreground/70" />
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {detailPanelData.problemArea.interview.personas.map(
                                      (p: Persona) => {
                                        const colorInfo = getPersonaColorById(p.color);
                                        return (
                                          <Badge
                                            key={p.id}
                                            title={p.name}
                                            className={cn(
                                              "text-sm py-0.5 px-2.5 h-6 transition-colors font-normal rounded-md",
                                              "max-w-xs",
                                              colorInfo.bg,
                                              colorInfo.text,
                                              colorInfo.border,
                                              `hover:${colorInfo.bg}`,
                                              `hover:${colorInfo.text}`
                                            )}
                                          >
                                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                              {p.name}
                                            </span>
                       </Badge>
                                        );
                                      }
                                    )}
                     </div>
                   </div>
                              )}
                 </div>
                          </div>

                          {/* -- Section 3: Tabs -- */}
                          <div className="flex justify-start border-t border-border/40 pt-4 mt-4">
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex justify-start">
                                <TabsList className="w-auto">
                                  <TabsTrigger value="details">Supporting Excerpts</TabsTrigger>
                                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                   </TabsList>
                 </div>
                            </div>
                          </div>
                        </>
                      )}
               </SheetHeader>
                  </div>

                  <TabsContent value="details" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      <div className="px-6 py-4">
                        <div className="space-y-4">
                          {detailPanelData?.problemArea.excerpts && 
                           detailPanelData.problemArea.excerpts.length > 0 ? (
                         detailPanelData.problemArea.excerpts.map((excerpt) => {
                           const excerptId = `excerpt-${excerpt.id}`;
                              const associatedChunk = detailPanelData.fullInterview?.analysis_data?.transcript?.find(
                                (c: any) => c.chunk_number === excerpt.chunk_number
                              );
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
                                   <>
                                     {!detailPanelData.fullInterview ? (
                                       <Button
                                         variant="link"
                                         size="sm"
                                         className="p-0 h-auto text-xs text-muted-foreground/10 hover:text-primary pointer-events-none"
                                         tabIndex={-1}
                                       >
                                         <div className="w-36 bg-muted-foreground/10 animate-pulse rounded-sm h-4" />
                                       </Button>
                                     ) : (
                                   <Button
                                     variant="link"
                                     size="sm"
                                     className="p-0 h-auto text-xs text-primary/90 hover:text-primary"
                                     onClick={() => scrollToChunk(excerpt.chunk_number, excerptId)}
                                       >
                                         View in transcript ({excerptTimestamp})
                                       </Button>
                                     )}
                                   </>
                                 )}
                               </CardContent>
                             </Card>
                           );
                         })
                       ) : (
                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                              <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                              <p className="text-muted-foreground text-sm">No supporting excerpts available.</p>
                            </div>
                       )}
                        </div>
                     </div>
                   </ScrollArea>
                 </TabsContent>

                  <TabsContent value="transcript" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full">
                      {detailPanelData?.loadingInterview ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                         <div className="relative h-8 w-8">
                           <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
                           <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                         </div>
                         <p className="text-sm text-muted-foreground animate-pulse">Loading transcript...</p>
                       </div>
                      ) : detailPanelData?.fullInterview?.analysis_data?.transcript ? (
                        <div className="space-y-2 px-3 pt-2">
                          {detailPanelData.fullInterview.analysis_data.transcript.map((chunk: any) => (
                           <div
                             key={chunk.chunk_number}
                             ref={(el) => { chunkRefs.current[chunk.chunk_number] = el; }}
                             className={cn(
                               "p-3 rounded-md transition-colors border border-border/40 hover:bg-muted/30 relative",
                               activeChunk === chunk.chunk_number ? "bg-yellow-100/80 !border-yellow-300 hover:bg-yellow-100/80" : ""
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
                                 <div className="flex items-baseline gap-2 mb-1">
                                   <span className="font-medium text-sm text-foreground/90">{chunk.speaker}</span>
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
                                 className="absolute top-2 right-2 h-7 px-2 text-xs bg-background/80 backdrop-blur-sm z-10"
                                 onClick={scrollToOriginatingElement}
                                >
                                  <Undo2 className="h-3 w-3 mr-1" /> Go Back
                                </Button>
                             )}
                           </div>
                         ))}
                       </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                          <p className="text-muted-foreground text-sm">Transcript data not available for this interview.</p>
                        </div>
                     )}
                   </ScrollArea>
                 </TabsContent>
             </Tabs>
              </div>
            </div>
          </SheetContent>
       </Sheet>

       {/* Add Delete Problem Area Confirmation Dialog */}
       <DeleteProblemAreaConfirmationDialog
         open={!!deletingProblemAreaInfo}
         onOpenChange={(open) => {
           if (!open) {
             setDeletingProblemAreaInfo(null);
             setIsProcessingPADelete(false);
           }
         }}
         onConfirm={handleConfirmPADelete}
         problemAreaTitle={deletingProblemAreaInfo?.title || ''}
         isDeleting={isProcessingPADelete}
       />
      
       {/* --- Render NEW Project Dialogs --- */}
       <EditProjectDialog 
         isOpen={isEditDialogOpen}
         onOpenChange={setIsEditDialogOpen}
         project={project} 
         onSave={handleSaveEditProject}
       />
       
       <DeleteProjectConfirmationDialog 
          open={!!deletingProjectInfo}
          onOpenChange={(open) => !open && setDeletingProjectInfo(null)}
          projectName={deletingProjectInfo?.name || ''}
          onConfirm={handleConfirmDeleteProject} // Pass the updated handler
          isDeleting={isDeletingProject}
       />
       {/* --- End NEW Project Dialogs --- */}
       
       {/* Upload Transcript Modal */}
       <UploadTranscriptModal 
         isOpen={isUploadModalOpen}
         onOpenChange={setIsUploadModalOpen}
         onUploadComplete={() => {
           // Refresh interviews when upload is complete
           const fetchData = async () => {
             const interviewsResponse = await getProjectInterviews(projectId);
             if (interviewsResponse.status === 'success') {
               setProjectInterviews(interviewsResponse.data?.interviews || []);
             }
           };
           fetchData();
         }}
         preSelectedProjectId={projectId}
        />

      {/* === Add Sheet Batch Delete Confirmation Dialog === */}
      <BatchDeleteConfirmationDialog
        open={isSheetBatchDeleteConfirmOpen}
        onOpenChange={setIsSheetBatchDeleteConfirmOpen}
        onConfirm={handleSheetBatchDeleteConfirm}
        itemCount={selectedSheetInterviewIds.size}
        itemTypePlural="interviews"
        isDeleting={isSheetBatchDeleting}
      />
      {/* === End Dialog === */}

    </div>
  )
}