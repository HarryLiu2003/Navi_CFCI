"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  Upload, 
  Plus,
  ChevronRight,
  User,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  ChevronLeft,
  CalendarIcon as CalendarIconLucide,
  Users,
  FileText,
  Search,
  Trash2,
  Loader2,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { useRouter } from 'next/navigation'
import { getInterviews, Interview, getProjects, Project, deleteInterview } from '@/lib/api'
import { toast } from 'sonner'
import { ScrollArea } from "@/components/ui/scroll-area"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Breadcrumb } from "@/components/ui/breadcrumb"

// Import Sheet components
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

// Import the new modal components
import { CreateProjectModal } from "@/components/dialogs/CreateProjectModal"
import { UploadTranscriptModal } from "@/components/dialogs/UploadTranscriptModal"
import { BatchDeleteConfirmationDialog } from '@/components/dialogs/BatchDeleteConfirmationDialog'

// Custom Month Picker Component (from reference)
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

// --- Skeleton Card Component (Helper) - STATIC ---
function ProjectCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden border border-border/40"> 
      {/* Top accent line */}
      <div className="h-1 w-full bg-muted animate-pulse" />
      
      <CardHeader className="pb-3 pt-5">
        {/* Project title skeleton */}
        <div className="h-7 w-2/3 bg-muted rounded-sm animate-pulse" />
        
        {/* Description skeleton with exact height match */}
        <div className="min-h-[48px]">
          <div className="mt-1.5 flex flex-col gap-1">
            <div className="h-5 w-full bg-muted rounded-sm animate-pulse" />
            <div className="h-5 w-4/5 bg-muted rounded-sm animate-pulse" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <div className="rounded-md bg-muted/30 p-3.5 flex flex-col gap-2.5">
          {/* Stats rows */}
          {[
            { iconWidth: 24, textWidth: 20 },
            { iconWidth: 20, textWidth: 28 }
          ].map((widths, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 rounded-sm bg-muted/50" />
                <div className={`h-5 w-${widths.iconWidth} rounded-sm bg-muted/50`} />
              </div>
              <div className={`h-5 w-${widths.textWidth} rounded-sm bg-muted/50`} />
            </div>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="pt-3 pb-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full border border-border/40 bg-muted animate-pulse" />
          <div className="h-5 w-32 rounded-sm bg-muted animate-pulse" />
        </div>
      </CardFooter>
    </Card>
  );
}

// --- Simple Skeleton for 4th column (Add New style) - STATIC ---
function AddProjectSkeleton() {
  return (
     <Card className="h-full border-2 border-dashed border-border/20 bg-muted/30 animate-pulse flex flex-col items-center justify-center">
        <CardContent className="flex flex-col items-center justify-center h-full py-8">
            <div className="rounded-full bg-muted p-3 mb-4 h-12 w-12"></div>
            <div className="h-5 w-32 bg-muted rounded"></div>
        </CardContent>
      </Card>
  );
}

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()
  
  // Upload State - Simplified
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  // Interview State
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false)

  // Project State - Simplified
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)

  // New State from Reference
  const [interviewTitleSearch, setInterviewTitleSearch] = useState("")
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined)
  const [showAllInterviews, setShowAllInterviews] = useState(false)

  // Interview Pagination State
  const [interviewPage, setInterviewPage] = useState(0)
  const [hasMoreInterviews, setHasMoreInterviews] = useState(true)
  const [isLoadingMoreInterviews, setIsLoadingMoreInterviews] = useState(false)
  const INTERVIEWS_PER_PAGE = 20

  // --- NEW State for Project List Sheet ---
  const [isProjectsSheetOpen, setIsProjectsSheetOpen] = useState(false);

  // --- NEW State for Selection & Batch Delete ---
  const [selectedInterviewIds, setSelectedInterviewIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // --- Data Fetching (Defined before useEffect) ---

  const fetchInterviews = useCallback(async (page = 0, append = false) => {
    if (page === 0) {
      setIsLoadingInterviews(true)
    } else {
      setIsLoadingMoreInterviews(true)
    }
    
    try {
      const response = await getInterviews(INTERVIEWS_PER_PAGE, page * INTERVIEWS_PER_PAGE)
      if (response?.status === 'success' && response.data?.interviews) {
        if (append) {
          setInterviews(prev => [...prev, ...response.data.interviews])
        } else {
          setInterviews(response.data.interviews)
        }
        
        setHasMoreInterviews(response.data.interviews.length === INTERVIEWS_PER_PAGE)
        
        if (page > 0) {
          setInterviewPage(page)
        }
      } else {
        if (!append) {
          setInterviews([])
        }
        setHasMoreInterviews(false)
        console.warn("No interviews found or failed response:", response?.message)
      }
    } catch (error) {
      console.error('Error fetching interviews:', error)
      if (!append) {
        setInterviews([])
      }
      setHasMoreInterviews(false)
      toast.error("Failed to load interviews.")
    } finally {
      if (page === 0) {
        setIsLoadingInterviews(false)
      } else {
        setIsLoadingMoreInterviews(false)
      }
    }
  }, []) // Empty dependency array

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const response = await getProjects(100, 0); // Fetch up to 100 projects
      if (response?.status === 'success' && response.data?.projects) {
        setProjects(response.data.projects);
      } else {
        setProjects([]);
        console.warn("No projects found or failed response:", response?.message)
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
      toast.error("Failed to load projects.");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []); // Empty dependency array

  // --- Effects ---

  // Fetch initial data on mount and when session status changes
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return; 
    }

    if (status === "authenticated") {
      // Fetch interviews and projects concurrently
      const fetchInitialData = async () => {
        // Reset states before fetching
        setIsLoadingInterviews(true); 
        setIsLoadingProjects(true); 
        setInterviews([]); // Clear previous interviews
        setProjects([]); // Clear previous projects
        setInterviewPage(0); // Reset page
        setHasMoreInterviews(true); // Assume there might be more initially

        const results = await Promise.allSettled([
          fetchInterviews(0, false), // Initial fetch, don't append yet
          fetchProjects()
        ]);

        // No need to manually set loading states to false here,
        // as the individual fetch functions handle their own states.
        // Error handling is also done within fetchInterviews/fetchProjects with toasts.
        
        // Log results for debugging if needed
        // console.log("[Page Load] Initial fetch results:", results);
      };
      
      fetchInitialData();
    }
    // Intentionally omitting fetchInterviews/fetchProjects from deps
    // to only run on initial auth status change
  }, [status, router]); // Run only when session status changes

  // Function to handle scroll and load more interviews
  const handleInterviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // When scrolled to 80% of the way down, load more
    const scrollThreshold = scrollHeight * 0.8
    
    if (scrollTop + clientHeight >= scrollThreshold && !isLoadingMoreInterviews && hasMoreInterviews) {
      fetchInterviews(interviewPage + 1, true)
    }
  }, [interviewPage, isLoadingMoreInterviews, hasMoreInterviews, fetchInterviews])

  // When switching between all/unassigned or changing filters, reset pagination
  useEffect(() => {
    setInterviewPage(0)
    setHasMoreInterviews(true)
    fetchInterviews(0, false)
  }, [showAllInterviews, selectedMonth, interviewTitleSearch, fetchInterviews])

  // --- Helper Functions ---

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }); 
    } catch (e) {
      return 'Invalid date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      }); 
    } catch (e) {
      return '';
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name || name.trim().length === 0) return "?"
    return name.trim()[0].toUpperCase();
  }

  // --- Filtering Logic ---

  // First, filter by text and month
  const filteredInterviews = interviews.filter((interview) => {
    const matchesTitle = interview.title?.toLowerCase().includes(interviewTitleSearch.toLowerCase()) ?? true;

    let matchesMonth = true
    if (selectedMonth) {
      try {
        const interviewDate = new Date(interview.created_at);
        matchesMonth =
          interviewDate.getMonth() === selectedMonth.getMonth() &&
          interviewDate.getFullYear() === selectedMonth.getFullYear();
      } catch {
        matchesMonth = false;
      }
    }

    return matchesTitle && matchesMonth;
  });

  // Then, filter based on the toggle state (showAll or unassigned)
  const interviewsToDisplay = filteredInterviews.filter(
    interview => showAllInterviews || !interview.project_id
  );

  // --- NEW Project Sorting Logic ---
  const sortedProjects = [...projects].sort((a, b) => {
    // Helper to safely parse date and return timestamp or 0
    const getTime = (dateString: string | undefined | null): number => {
      if (!dateString) return 0;
      try {
        return new Date(dateString).getTime();
      } catch {
        return 0;
      }
    };

    // Get the latest interview date for project A, default to 0 if none
    const latestInterviewTimeA = a.interviews && a.interviews.length > 0 
      ? getTime(a.interviews[0].created_at) 
      : 0;
    // Get the project update time for project A
    const projectUpdateTimeA = getTime(a.updatedAt);
    // Use the more recent of the two for comparison
    const effectiveTimestampA = Math.max(latestInterviewTimeA, projectUpdateTimeA);

    // Get the latest interview date for project B, default to 0 if none
    const latestInterviewTimeB = b.interviews && b.interviews.length > 0 
      ? getTime(b.interviews[0].created_at) 
      : 0;
    // Get the project update time for project B
    const projectUpdateTimeB = getTime(b.updatedAt);
    // Use the more recent of the two for comparison
    const effectiveTimestampB = Math.max(latestInterviewTimeB, projectUpdateTimeB);

    // Sort descending (newest first)
    return effectiveTimestampB - effectiveTimestampA;
  });
  // Display only the top 3 sorted projects
  const displayedProjects = sortedProjects.slice(0, 3);

  // --- NEW Batch Delete Logic ---
  const handleBatchDelete = async () => {
    setIsBatchDeleting(true);
    const idsToDelete = Array.from(selectedInterviewIds);
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
        const interviewTitle = interviews.find(i => i.id === interviewId)?.title || interviewId;
        const errorMessage = (result.status === 'rejected') 
          ? result.reason?.message 
          : (result.value as any)?.message || 'Unknown error';
        console.error(`Failed to delete interview ${interviewTitle} (${interviewId}): ${errorMessage}`);
      }
    });

    if (successCount > 0) {
      toast.success(`${successCount} interview${successCount > 1 ? 's' : ''} deleted successfully.`);
      setInterviews(prev => prev.filter(interview => !selectedInterviewIds.has(interview.id)));
    }
    if (failCount > 0) {
      toast.error(`${failCount} interview${failCount > 1 ? 's' : ''} could not be deleted. See console for details.`);
    }

    setSelectedInterviewIds(new Set());
    setIsBatchDeleteConfirmOpen(false);
    setIsBatchDeleting(false);
  };

  // --- Selection Logic ---
  const handleRowCheckboxChange = (checked: boolean | 'indeterminate', interviewId: string) => {
    setSelectedInterviewIds(prev => {
      const newSet = new Set(prev);
      if (checked === true) {
        newSet.add(interviewId);
      } else {
        newSet.delete(interviewId);
      }
      return newSet;
    });
  };

  const handleHeaderCheckboxChange = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedInterviewIds(new Set(interviewsToDisplay.map(i => i.id)));
    } else {
      setSelectedInterviewIds(new Set());
    }
  };

  const getHeaderCheckboxState = () => {
    const visibleIds = new Set(interviewsToDisplay.map(i => i.id));
    const selectedVisibleCount = Array.from(selectedInterviewIds).filter(id => visibleIds.has(id)).length;
    
    if (selectedVisibleCount === 0 || interviewsToDisplay.length === 0) {
      return false;
    } else if (selectedVisibleCount === interviewsToDisplay.length) {
      return true;
    } else {
      return 'indeterminate';
    }
  };
  const headerCheckboxState = getHeaderCheckboxState(); // Calculate once for render

  // --- Render Logic ---

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-8 py-3.5 border-b border-border/40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                  Navi ProductForce
                </h1>
                <Badge variant="outline" className="font-normal text-xs text-muted-foreground/70 bg-background/50">Beta</Badge>
              </div>
              <Breadcrumb items={[]} />
            </div>
            
            <div className="flex items-center gap-4">
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

      {/* Main content with right-aligned scroll */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 md:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              {/* Welcome section */}
              <section className="mb-12">
                <div className="bg-gradient-to-br from-primary/[0.03] via-primary/[0.05] to-background border border-border/40 overflow-hidden rounded-xl relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.07] to-transparent pointer-events-none" />
                  <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between p-8 gap-6">
                    <div className="space-y-2.5">
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground/90">
                        Welcome back, {session?.user?.name?.split(" ")[0] || 'User'} 👋
                      </h1>
                      <p className="text-base text-muted-foreground/90">
                        Ready to analyze your next user interview? Upload a transcript to get started.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Trigger for the UploadTranscriptModal */}
                      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                        <DialogTrigger asChild>
                          <Button size="lg" className="h-10 shadow-sm bg-background hover:bg-background/90 text-foreground/90 hover:text-foreground">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Interview Transcript
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </div>
                  <div className="relative border-t border-border/40 bg-background/50 backdrop-blur-[2px] px-8 py-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                      <FileText className="h-4 w-4" />
                      <span>Supports .vtt and .txt transcript files</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Projects Section */}
              <section className="mb-12">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold tracking-tight">Your Projects</h2>
                  {/* Trigger for the CreateProjectModal */}
                  <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground/70 hover:text-primary"
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Project
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
                <div className="grid gap-6 md:grid-cols-4">
                  {/* --- Skeleton Loader --- */} 
                  {isLoadingProjects ? (
                    <> 
                      <ProjectCardSkeleton />
                      <ProjectCardSkeleton />
                      <ProjectCardSkeleton />
                      <AddProjectSkeleton />
                    </>
                  ) : (
                  // --- Loaded State --- 
                    <> 
                      {/* Project Cards (Mapped from displayedProjects) */}
                      {displayedProjects.map((project) => (
                        <Link href={`/project/${project.id}/prioritize`} key={project.id} className="block">
                          <Card className="h-full overflow-hidden border border-border/40 hover:border-border/80 transition-all duration-200 hover:shadow-md">
                            <div className="h-1 bg-primary/80 w-full"></div> 
                            <CardHeader className="pb-3 pt-5">
                              <CardTitle className="text-xl font-semibold tracking-tight text-foreground/90 hover:text-primary transition-colors">
                                {project.name}
                              </CardTitle>
                              <div className="min-h-[48px]">
                                <CardDescription className="line-clamp-2 text-sm text-muted-foreground/90 mt-1.5">
                                  {project.description || "No description"}
                                </CardDescription>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex flex-col space-y-2.5 bg-muted/30 rounded-md p-3.5">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center text-muted-foreground/80">
                                    <CalendarIconLucide className="h-3.5 w-3.5 mr-2" />
                                    <span>Last Interview</span>
                                  </div>
                                  <span className="text-foreground/90">
                                    {(project.interviews && project.interviews.length > 0 && project.interviews[0].created_at)
                                      ? formatDate(project.interviews[0].created_at)
                                      : "None"
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center text-muted-foreground/80">
                                    <FileText className="h-3.5 w-3.5 mr-2" />
                                    <span>Interviews</span>
                                  </div>
                                  <span className="text-foreground/90">
                                    {/* Display the count (which now represents last month) */}
                                    {project._count?.interviews ?? 0} last month 
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                            <CardFooter className="pt-3 pb-5">
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-6 w-6 border border-border/40">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(project.owner?.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-foreground/90 truncate" title={project.owner?.name ?? project.ownerId}>
                                  {project.owner?.name ?? `Owner ${project.ownerId.substring(0, 6)}...`}
                                </span>
                              </div>
                            </CardFooter>
                          </Card>
                        </Link>
                      ))}

                      {/* Fourth Column Block (Conditional View All / Add New) */}
                      <div className={cn(
                        "flex flex-col gap-6",
                        projects.length === 0 && "md:col-start-1"
                      )}>
                        {/* Conditional View All Projects */} 
                        {projects.length >= 4 && (
                          <Card 
                            className="h-full overflow-hidden border border-border/40 hover:border-border/80 transition-all duration-200 hover:shadow-md cursor-pointer"
                            onClick={() => setIsProjectsSheetOpen(true)}
                          >
                            <div className="h-1 bg-primary/80 w-full"></div>
                            <CardHeader className="pb-3 pt-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-xl font-semibold tracking-tight text-foreground/90 hover:text-primary transition-colors">
                                    View All Projects
                                  </CardTitle>
                                  <CardDescription className="text-sm text-muted-foreground/90 mt-1.5">
                                    {projects.length} total projects
                                  </CardDescription>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-colors" />
                              </div>
                            </CardHeader>
                          </Card>
                        )}
                        
                        {/* Add New Project Card - Triggers CreateProjectModal */} 
                        <Card 
                          className="h-full border-2 border-dashed border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer flex-1" 
                          onClick={() => setIsProjectModalOpen(true)} // Open the modal
                        >
                          <CardContent className="flex flex-col items-center justify-center h-full py-8">
                            <div className="rounded-full bg-primary/10 p-3 mb-4">
                              <Plus className="h-6 w-6 text-primary" />
                            </div>
                            <p className="font-medium text-primary/80">Add New Project</p>
                          </CardContent>
                        </Card>
                      </div>
                    </> 
                  )}
                </div>
              </section>

              {/* Interviews Section with Independent Scroll */}
              <section className="space-y-4 mb-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold tracking-tight">Recent Interviews</h2>
                  {/* Trigger for the UploadTranscriptModal */}
                  <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-muted-foreground/70 hover:text-primary"
                      >
                        <Upload className="h-4 w-4 mr-1.5" />
                        Upload Transcript
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>

                <div className="space-y-5">
                  {/* Filter controls are always visible now (unless hidden by other logic) */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center min-h-[40px]">
                      <>
                        <Button
                          variant="outline"
                          size="default"
                          className="w-[200px] justify-start text-left font-normal border-border/40 hover:border-border/60 transition-colors h-10"
                          onClick={() => setShowAllInterviews(!showAllInterviews)}
                        >
                          {showAllInterviews ? (
                            <>
                              <Users className="h-4 w-4 mr-2" />
                              Show Unassigned
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Show All Interviews
                            </>
                          )}
                        </Button>

                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                          <Input
                            placeholder="Search interviews by title..."
                            className="pl-9 bg-background border-border/40 hover:border-border/60 transition-colors"
                            value={interviewTitleSearch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterviewTitleSearch(e.target.value)}
                          />
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={`w-full sm:w-[200px] justify-start text-left font-normal border-border/40 hover:border-border/60 transition-colors ${!selectedMonth ? "text-muted-foreground/70" : ""}`}
                            >
                              <CalendarIconLucide className="mr-2 h-4 w-4" />
                              {selectedMonth 
                                ? selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) 
                                : "Filter by month"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <MonthPicker selected={selectedMonth} onSelect={setSelectedMonth} />
                            {selectedMonth && (
                              <div className="p-3 border-t border-border/20">
                                <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedMonth(undefined)}>
                                  Clear
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </>
                  </div>

                  {/* Interviews Table */}
                  <div className="bg-card rounded-lg border border-border/40 overflow-hidden shadow-sm">
                    {/* Sticky Header */}
                    <div className="bg-muted/30 border-b border-border/40 sticky top-0 z-10 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
                      {/* === 5 COLUMN GRID HEADER === */}
                      <div className="grid grid-cols-[auto_minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)] gap-0 px-0 text-sm font-medium text-muted-foreground/90 items-center">
                        {/* Col 1: Checkbox */}
                        <div className="col-span-1 px-4 py-3.5 border-r border-border/20 flex items-center justify-center">
                          <Checkbox
                            id="select-all-interviews"
                            checked={headerCheckboxState}
                            onCheckedChange={handleHeaderCheckboxChange}
                            aria-label="Select all visible interviews"
                            disabled={interviewsToDisplay.length === 0}
                            className={interviewsToDisplay.length === 0 ? 'opacity-50' : ''}
                          />
                        </div>
                        {/* Col 2: Title */}
                        <div className="col-span-1 px-6 py-3.5 border-r border-border/20 whitespace-nowrap">Title</div>
                        {/* Col 3: Date */}
                        <div className="col-span-1 px-6 py-3.5 border-r border-border/20 whitespace-nowrap">Date</div>
                        {/* Col 4: Project */}
                        <div className="col-span-1 px-6 py-3.5 border-r border-border/20 whitespace-nowrap">Project</div>
                        {/* Col 5: Participants Header + Delete Action */}
                        <div className="col-span-1 px-6 py-3.5 flex items-center justify-between"> 
                          <span className="whitespace-nowrap">Participants</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              if (selectedInterviewIds.size > 0 && !isBatchDeleting) {
                                setIsBatchDeleteConfirmOpen(true);
                              }
                            }}
                            className={cn(
                              "h-7 w-7 -mr-2", 
                              selectedInterviewIds.size > 0 
                                ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                                : "text-muted-foreground/30 cursor-not-allowed"
                            )}
                            disabled={selectedInterviewIds.size === 0 || isBatchDeleting}
                            aria-label="Delete selected interviews"
                          >
                            {isBatchDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Table Body */}
                    <div 
                      className="max-h-[600px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border scrollbar-track-muted/30 hover:scrollbar-thumb-border/60 transition-colors"
                      onScroll={handleInterviewScroll}
                    >
                      <div className="relative min-h-[240px]">
                        {isLoadingInterviews ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                              <p className="text-sm text-muted-foreground">Loading interviews...</p>
                            </div>
                          </div>
                        ) : interviews.length === 0 ? (
                           <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center justify-center text-center px-6">
                              <div className="rounded-full bg-muted/30 p-4 mb-4">
                                <FileText className="h-8 w-8 text-primary/30" />
                              </div>
                              <h3 className="text-lg font-medium mb-2">No interviews uploaded yet</h3>
                              <p className="text-muted-foreground max-w-md mb-4">
                                Upload your first interview transcript using the button above to get started.
                              </p>
                              <Button onClick={() => setIsUploadModalOpen(true)} variant="outline" size="sm">
                                <Upload className="h-3.5 w-3.5 mr-1.5"/>
                                Upload Transcript
                              </Button>
                            </div>
                          </div>
                        ) : interviewsToDisplay.length === 0 ? (
                           <div className="absolute inset-0 flex items-center justify-center">
                             <div className="flex flex-col items-center justify-center text-center px-6">
                              <div className="rounded-full bg-muted/30 p-4 mb-4">
                                <FileText className="h-8 w-8 text-primary/30" /> 
                              </div>
                              <h3 className="text-lg font-medium mb-2">No {!showAllInterviews ? "unassigned " : ""}interviews match</h3>
                              <p className="text-muted-foreground max-w-md">
                                {!showAllInterviews 
                                  ? "It looks like all available interviews are assigned to projects."
                                  : "Try adjusting your search or filter criteria, or clear them to see all interviews."
                                }
                              </p>
                              <div className="flex gap-2 mt-4">
                                {interviewTitleSearch && (
                                  <Button variant="outline" size="sm" onClick={() => setInterviewTitleSearch("")}>Clear Search</Button>
                                )}
                                {selectedMonth && (
                                  <Button variant="outline" size="sm" onClick={() => setSelectedMonth(undefined)}>Clear Month Filter</Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {interviewsToDisplay
                              .map((interview) => (
                                <div 
                                  key={interview.id} 
                                  className={cn(
                                    // === 5 COLUMN GRID ROW ===
                                    "grid grid-cols-[auto_minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)] gap-0 items-center hover:bg-muted/30 transition-colors",
                                    "group relative",
                                    selectedInterviewIds.has(interview.id) ? 'bg-muted/50' : ''
                                  )}
                                >
                                  {/* Col 1: Row Checkbox */}
                                  <div className="col-span-1 px-4 py-3.5 h-14 flex items-center justify-center border-r border-b border-border/20">
                                    <Checkbox 
                                      id={`select-interview-${interview.id}`}
                                      checked={selectedInterviewIds.has(interview.id)}
                                      onCheckedChange={(checked: boolean | 'indeterminate') => handleRowCheckboxChange(checked, interview.id)}
                                      aria-labelledby={`interview-title-${interview.id}`}
                                    />
                                  </div>
                                  
                                  {/* Col 2: Title Link */}
                                  <Link href={`/interview-analysis/${interview.id}`} className="col-span-1 contents">
                                    <div id={`interview-title-${interview.id}`} className={cn("px-6 py-3.5 h-14 flex items-center text-sm font-medium text-foreground/90 border-r border-b border-border/20 group-hover:text-primary transition-colors overflow-x-auto scrollbar-thin cursor-pointer")}>
                                      <div className="whitespace-nowrap">{interview.title}</div>
                                    </div>
                                  </Link>
                                  {/* Col 3: Date Link */}
                                  <Link href={`/interview-analysis/${interview.id}`} className="col-span-1 contents">
                                    <div className={cn("px-6 py-3.5 h-14 flex items-center text-sm text-muted-foreground border-r border-b border-border/20 overflow-x-auto scrollbar-thin cursor-pointer")}>
                                      <div className="whitespace-nowrap">{formatDate(interview.created_at)} {formatTime(interview.created_at)}</div>
                                    </div>
                                  </Link>
                                  {/* Col 4: Project Link - REMOVE outer Link */}
                                  {/* <Link href={`/interview-analysis/${interview.id}`} className="col-span-1 contents"> */}
                                    <div className={cn("px-6 py-3.5 h-14 flex items-center text-sm text-muted-foreground border-r border-b border-border/20 overflow-x-auto scrollbar-thin")}>
                                      {interview.project && interview.project.id ? (
                                        <Link 
                                          href={`/project/${interview.project.id}/prioritize`}
                                          className="hover:underline inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer whitespace-nowrap text-foreground/90"
                                          onClick={(e) => e.stopPropagation()} // Prevent row selection if needed
                                          title={`Go to project: ${interview.project.name}`}
                                        >
                                          {interview.project?.name || 'Unknown Project'}
                                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all flex-shrink-0" />
                                        </Link>
                                      ) : (
                                        <div className="whitespace-nowrap text-muted-foreground/50">—</div>
                                      )}
                                    </div>
                                  {/* </Link> */}
                                  {/* Col 5: Participants Link - Keep outer link */}
                                  <Link href={`/interview-analysis/${interview.id}`} className="col-span-1 contents">
                                     <div className={cn("px-6 py-3.5 h-14 flex items-center text-sm border-b border-border/20 overflow-x-auto scrollbar-thin cursor-pointer")}> 
                                        <div className="flex items-center gap-4 whitespace-nowrap">
                                          {interview.participants?.split(',').filter(p => p.trim()).map((participant, i) => (
                                            <div key={i} className="flex items-center gap-1.5 flex-shrink-0" title={participant.trim()}>
                                              <Avatar className="h-6 w-6 border border-border/40"><AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(participant.trim())}</AvatarFallback></Avatar>
                                              <span className="text-foreground/90">{participant.trim()}</span>
                                            </div>
                                          ))}
                                        </div>
                                     </div>
                                  </Link>
                                  
                                </div> 
                              ))}
                            {isLoadingMoreInterviews && (
                              <div className="py-6 text-center">
                                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                <p className="text-sm text-muted-foreground mt-2">Loading more interviews...</p>
                              </div>
                            )}
                            
                            {!hasMoreInterviews && interviews.length > INTERVIEWS_PER_PAGE && (
                              <div className="py-6 text-center text-sm text-muted-foreground/70">
                                You've reached the end
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Render the Modals */}
      <CreateProjectModal 
        isOpen={isProjectModalOpen} 
        onOpenChange={setIsProjectModalOpen} 
        onProjectCreated={fetchProjects} // Pass fetchProjects to refresh list on creation
      />
      
      <UploadTranscriptModal 
        isOpen={isUploadModalOpen} 
        onOpenChange={setIsUploadModalOpen} 
        onUploadComplete={fetchInterviews} // Pass fetchInterviews to refresh list on upload
      />

      {/* Use the new Batch Delete Confirmation Dialog Component */}
      <BatchDeleteConfirmationDialog
        open={isBatchDeleteConfirmOpen}
        onOpenChange={setIsBatchDeleteConfirmOpen}
        onConfirm={handleBatchDelete}
        itemCount={selectedInterviewIds.size}
        itemTypePlural="interviews"
        isDeleting={isBatchDeleting}
      />

      {/* --- NEW: All Projects Right Sheet --- */}
      <Sheet open={isProjectsSheetOpen} onOpenChange={setIsProjectsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col [&>button]:hidden">
           <div className="flex flex-1 min-h-0"> {/* Parent Flex Container */}

            {/* --- Closer Button (Now on the Left for Right Sheet) --- */}
            <div 
              onClick={() => setIsProjectsSheetOpen(false)}
              className="w-12 flex items-center justify-center border-r border-border/40 hover:bg-muted/40 transition-colors cursor-pointer bg-muted/20" // Correct border-r
              role="button"
              aria-label="Close panel"
            >
              <ChevronsRight className="h-5 w-5 text-muted-foreground/70" /> 
            </div>

            {/* --- Main Content Area (Header + ScrollArea) --- */}
            <div className="flex-1 flex flex-col">
              <SheetHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex justify-between items-center space-y-0">
                  <div>
                    <SheetTitle className="text-lg font-semibold tracking-tight">All Projects</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground/80 mt-1">
                      {projects.length} project{projects.length !== 1 ? 's' : ''} found
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <ScrollArea className="flex-1 min-h-0">
                <div className="divide-y divide-border/40">
                  {projects.length > 0 ? (
                    sortedProjects.map(project => (
                      <Link 
                        href={`/project/${project.id}/prioritize`} 
                        key={project.id} 
                        className="block p-4 hover:bg-muted/40 transition-colors space-y-1.5" 
                        onClick={() => setIsProjectsSheetOpen(false)} 
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-medium text-foreground/90 truncate flex-shrink min-w-0" title={project.name}>
                             {project.name}
                          </p>
                          {project.description && (
                            <p className="text-xs text-muted-foreground/80 truncate flex-shrink-0 ml-auto pl-2" title={project.description}>
                              {project.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5" title="Last Activity">
                            <CalendarIconLucide className="h-3.5 w-3.5" />
                            <span>
                              {
                                (project.interviews && project.interviews.length > 0 && project.interviews[0].created_at) 
                                  ? formatDate(project.interviews[0].created_at) 
                                  : project.updatedAt ? formatDate(project.updatedAt) : 'N/A'
                              }
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5" title="Total Interviews">
                            <FileText className="h-3.5 w-3.5" />
                            <span>{project._count?.interviews ?? 0} Interview{project._count?.interviews !== 1 ? 's' : ''} last month</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground text-sm">No projects created yet.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div> {/* End Main Content Area div */} 

          </div> {/* End Parent Flex Container div */} 
        </SheetContent>
      </Sheet>
      {/* --- End All Projects Sheet --- */}

    </div>
  )
}

