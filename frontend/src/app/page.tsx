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
  RefreshCw,
  Check,
  ChevronsUpDown,
  Users,
  FileText,
  Search,
  ChevronLeft,
  CalendarIcon as CalendarIconLucide,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from 'next/navigation'
import { analyzeTranscript, getInterviews, Interview, createProject, getProjects, Project } from '@/lib/api'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
      <div className="h-1 bg-muted animate-pulse w-full"></div> 
      <CardHeader className="pb-3 pt-5">
        <div className="h-6 w-2/3 bg-muted rounded animate-pulse mb-3"></div>
        <div className="min-h-[48px] space-y-2">
          <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-4/5 bg-muted rounded animate-pulse"></div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2.5 bg-muted/30 rounded-md p-3.5 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-muted/50 rounded"></div>
            <div className="h-4 w-20 bg-muted/50 rounded"></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 bg-muted/50 rounded"></div>
            <div className="h-4 w-28 bg-muted/50 rounded"></div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-3 pb-5">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-full bg-muted animate-pulse"></div>
          <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
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
  
  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Interview State
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false)

  // Project State
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDescription, setNewProjectDescription] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  
  // Combobox State
  const [isProjectComboboxOpen, setIsProjectComboboxOpen] = useState(false)

  // New State from Reference
  const [interviewTitleSearch, setInterviewTitleSearch] = useState("")
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined)
  const [showAllInterviews, setShowAllInterviews] = useState(false)

  // Interview Pagination State
  const [interviewPage, setInterviewPage] = useState(0)
  const [hasMoreInterviews, setHasMoreInterviews] = useState(true)
  const [isLoadingMoreInterviews, setIsLoadingMoreInterviews] = useState(false)
  const INTERVIEWS_PER_PAGE = 20

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
        
        // Check if we have more interviews to load
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

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

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

  // Load initial data on component mount if authenticated
  useEffect(() => {
    if (status === "authenticated") {
      fetchInterviews(0, false)
      fetchProjects() 
    }
  }, [status, fetchInterviews, fetchProjects]) // Include useCallback functions here

  // --- Event Handlers ---

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.name.endsWith(".vtt") || file.name.endsWith(".txt"))) {
      setSelectedFile(file)
    } else {
      toast.warning("Please select a .vtt or .txt file")
      event.target.value = ""
      setSelectedFile(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Please select a transcript file.')
      return
    }

    setIsAnalyzing(true)
    const analysisToastId = toast.loading('Analyzing transcript...')

    try {
      console.log("[handleSubmit] Starting analysis. Selected Project ID:", selectedProjectId);
      
      const result = await analyzeTranscript(selectedFile, session?.user?.id, selectedProjectId)
      
      if (!result?.data) {
        toast.error('Invalid response received from the server.', { id: analysisToastId })
        setIsAnalyzing(false)
        return
      }
      
      toast.success('Analysis complete!', { id: analysisToastId })
      
      setSelectedFile(null)
      setSelectedProjectId(undefined)
      setIsProjectComboboxOpen(false)
      setIsUploadModalOpen(false)
      
      fetchInterviews()
      
      if (result.data.storage?.id) {
        router.push(`/interview-analysis/${result.data.storage.id}`)
      } else {
        console.error("Analysis successful but storage.id missing in response")
      }
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Failed to analyze transcript'
      toast.error(errorMessage, { id: analysisToastId, duration: 5000 })
    } finally {
        setIsAnalyzing(false)
    }
  }

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) {
      toast.error("Project name is required.")
      return
    }

    setIsCreatingProject(true)
    const creationToastId = toast.loading("Creating project...")

    try {
      const response = await createProject(newProjectName.trim(), newProjectDescription.trim())
      toast.success(`Project "${response.data?.name}" created successfully!`, { id: creationToastId })
      setIsProjectModalOpen(false)
      setNewProjectName("")
      setNewProjectDescription("")
      fetchProjects()
    } catch (error: any) {
      console.error("Error creating project:", error)
      toast.error(error.message || "An error occurred while creating the project.", { 
        id: creationToastId,
        duration: 5000
      })
    } finally {
      setIsCreatingProject(false)
    }
  }

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
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
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

  // Project sorting remains the same
  const sortedProjects = [...projects].sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  });
  const displayedProjects = sortedProjects.slice(0, 3);

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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight bg-gradient-to-r from-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                Navi ProductForce
              </h1>
              <Badge variant="outline" className="font-normal text-xs text-muted-foreground/70 bg-background/50">Beta</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative h-8 w-8 text-muted-foreground/70 hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
              </Button>
              
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
                <DropdownMenuContent align="end" className="w-56">
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
                      <p className="text-base text-muted-foreground/80">
                        Ready to analyze your next user interview? Upload a transcript to get started.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Dialog open={isUploadModalOpen} onOpenChange={(open) => {
                        setIsUploadModalOpen(open)
                        if (!open) {
                          setSelectedFile(null)
                          setSelectedProjectId(undefined)
                          setIsProjectComboboxOpen(false)
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="lg" className="h-10 shadow-sm bg-background hover:bg-background/90 text-foreground/90 hover:text-foreground">
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Interview Transcript
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Upload Interview Transcript</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleSubmit} className="space-y-6 py-2">
                            {/* File Upload Input - Moved to top */}
                            <div className="space-y-1.5">
                              <Label htmlFor="file">Transcript File</Label>
                              <Input
                                id="file"
                                type="file"
                                accept=".vtt,.txt"
                                onChange={handleFileChange}
                                required
                              />
                              <p className="text-sm text-muted-foreground">
                                Upload a .vtt or .txt format transcript file.
                              </p>
                            </div>

                            {/* Project Selection - Moved below file upload */}
                            <div className="space-y-1.5">
                              <Label htmlFor="project-search">Assign to Project (Optional)</Label>
                              <div className="relative">
                                <Button
                                  type="button"
                                  id="project-search"
                                  variant="outline"
                                  role="combobox"
                                  onClick={() => setIsProjectComboboxOpen(!isProjectComboboxOpen)}
                                  className="w-full justify-between font-normal border-border/40 hover:border-border/60 transition-colors"
                                >
                                  <span className="truncate">
                                    {selectedProjectId
                                      ? projects.find((project) => project.id === selectedProjectId)?.name
                                      : "Select project..."}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                                
                                {isProjectComboboxOpen && (
                                  <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border/40 bg-background shadow-md">
                                    <div className="flex items-center border-b px-3 py-2">
                                      <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                                      <input
                                        placeholder="Search projects..."
                                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                                        onChange={(e) => {
                                          const value = e.target.value.toLowerCase();
                                          const filteredProjects = document.querySelectorAll('[data-project-item]');
                                          
                                          filteredProjects.forEach((item) => {
                                            const name = item.getAttribute('data-project-name')?.toLowerCase() || '';
                                            if (name.includes(value)) {
                                              item.classList.remove('hidden');
                                            } else {
                                              item.classList.add('hidden');
                                            }
                                          });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                      />
                                    </div>
                                    <div className="max-h-[200px] overflow-auto p-1">
                                      {projects.length === 0 ? (
                                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">No projects found.</div>
                                      ) : (
                                        <div>
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
                                          
                                          {projects.map((project) => (
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
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {isLoadingProjects && (
                                <p className="text-xs text-muted-foreground flex items-center">
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Loading projects...
                                </p>
                              )}
                            </div>
                            
                            {/* Submit Button - Update disabled condition for transcript upload */}
                            <Button 
                              type="submit" 
                              className="w-full" 
                              disabled={!selectedFile || isAnalyzing}
                            >
                              {isAnalyzing ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> 
                              ) : (
                                'Upload and Analyze'
                              )}
                            </Button>
                          </form>
                        </DialogContent>
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
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
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
                        {/* Submit Button - Update disabled condition for project creation */}
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={!newProjectName.trim() || isCreatingProject}
                        >
                          {isCreatingProject ? (
                            <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                          ) : ( 'Create Project' )}
                        </Button>
                      </form>
                    </DialogContent>
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
                        <Link href={`/project/${project.id}`} key={project.id} className="block">
                          <Card className="h-full overflow-hidden border border-border/40 hover:border-border/80 transition-all duration-200 hover:shadow-md">
                            <div className="h-1 bg-primary/80 w-full"></div> 
                            <CardHeader className="pb-3 pt-5">
                              <CardTitle className="text-xl font-semibold tracking-tight text-foreground/90 hover:text-primary transition-colors">
                                {project.name}
                              </CardTitle>
                              <div className="min-h-[48px]">
                                <CardDescription className="line-clamp-2 text-sm text-muted-foreground/80 mt-1.5">
                                  {project.description || "No description"}
                                </CardDescription>
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex flex-col space-y-2.5 bg-muted/30 rounded-md p-3.5">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center text-muted-foreground/80">
                                    <CalendarIconLucide className="h-3.5 w-3.5 mr-2" />
                                    <span>Last updated</span>
                                  </div>
                                  <span className="text-muted-foreground/90">
                                    {project.updatedAt ? formatDate(project.updatedAt) : "N/A"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center text-muted-foreground/80">
                                    <FileText className="h-3.5 w-3.5 mr-2" />
                                    <span>Interviews</span>
                                  </div>
                                  <span className="text-muted-foreground/90">
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
                                <span className="text-sm text-muted-foreground/90 font-medium truncate" title={project.owner?.name ?? project.ownerId}>
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
                          <Link href="/projects" className="block">
                             <Card className="h-full overflow-hidden border border-border/40 hover:border-border/80 transition-all duration-200 hover:shadow-md">
                              <div className="h-1 bg-primary/80 w-full"></div>
                              <CardHeader className="pb-3 pt-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <CardTitle className="text-xl font-semibold tracking-tight text-foreground/90 hover:text-primary transition-colors">
                                      View All Projects
                                    </CardTitle>
                                    <CardDescription className="text-sm text-muted-foreground/80 mt-1.5">
                                      {projects.length} total projects
                                    </CardDescription>
                                  </div>
                                  <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                                </div>
                              </CardHeader>
                            </Card>
                          </Link>
                        )}
                        
                        {/* Add New Project Card */} 
                        <Card 
                          className="h-full border-2 border-dashed border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer flex-1" 
                          onClick={() => setIsProjectModalOpen(true)}
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
                  <div className="flex flex-col sm:flex-row gap-4">
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
                        onChange={(e) => setInterviewTitleSearch(e.target.value)}
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
                  </div>

                  <div className="bg-card rounded-lg border border-border/40 overflow-hidden shadow-sm">
                    {/* Sticky Header - 4-2-2-4 Widths */}
                    <div className="bg-muted/30 border-b border-border/40 sticky top-0 z-10 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
                      <div className="grid grid-cols-12 gap-0 px-0 text-sm font-medium text-muted-foreground/80">
                        {/* Apply 4-2-2-4 distribution */}
                        <div className="col-span-4 px-6 py-3.5 border-r border-border/20 whitespace-nowrap overflow-x-auto scrollbar-thin">Title</div>
                        <div className="col-span-2 px-6 py-3.5 border-r border-border/20 whitespace-nowrap overflow-x-auto scrollbar-thin">Date</div>
                        <div className="col-span-2 px-6 py-3.5 border-r border-border/20 whitespace-nowrap overflow-x-auto scrollbar-thin">Project</div>
                        <div className="col-span-4 px-6 py-3.5 whitespace-nowrap overflow-x-auto scrollbar-thin">Participants</div>
                      </div>
                    </div>

                    {/* Table Body - Increased Participant Spacing */}
                    <div 
                      className="max-h-[600px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border scrollbar-track-muted/30 hover:scrollbar-thumb-border/60 transition-colors"
                      onScroll={handleInterviewScroll}
                    >
                      <div className="relative min-h-[240px]">
                        {isLoadingInterviews ? (
                          // Loading State - Center within the min-height
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                              <p className="text-sm text-muted-foreground">Loading interviews...</p>
                            </div>
                          </div>
                        ) : interviews.length === 0 ? (
                          // Initial Empty State - Center within the min-height
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
                          // Filtered/View Empty State - Center within the min-height
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
                              .map((interview, index, filteredArray) => (
                                <Link href={`/interview-analysis/${interview.id}`} key={interview.id}>
                                  <div
                                    className={cn(
                                      "grid grid-cols-12 gap-0 px-0 items-center hover:bg-muted/30 transition-colors",
                                      "group"
                                    )}
                                  >
                                    {/* Title Cell - Unconditional border-b */}
                                    <div className={cn(
                                      "col-span-4 px-6 py-3.5 h-14 flex items-center text-sm font-medium text-foreground/90 border-r border-b border-border/20 group-hover:text-primary transition-colors overflow-x-auto scrollbar-thin"
                                    )}>
                                      <div className="whitespace-nowrap">{interview.title}</div>
                                    </div>
                                    {/* Date Cell - Unconditional border-b */}
                                    <div className={cn(
                                      "col-span-2 px-6 py-3.5 h-14 flex items-center text-sm text-muted-foreground border-r border-b border-border/20 overflow-x-auto scrollbar-thin"
                                    )}>
                                      <div className="whitespace-nowrap">
                                        {formatDate(interview.created_at)} {formatTime(interview.created_at)}
                                      </div>
                                    </div>
                                    {/* Project Cell - Unconditional border-b */}
                                    <div className={cn(
                                      "col-span-2 px-6 py-3.5 h-14 flex items-center text-sm text-muted-foreground border-r border-b border-border/20 overflow-x-auto scrollbar-thin"
                                    )}>
                                      {interview.project ? (
                                        <span
                                          className="hover:underline inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
                                          style={{ color: 'inherit' }}
                                          onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            if (interview.project?.id) { 
                                              router.push(`/project/${interview.project.id}`);
                                            }
                                          }}
                                        >
                                          {interview.project?.name || 'Unknown Project'}
                                          <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all flex-shrink-0" />
                                        </span>
                                      ) : (
                                        <div className="whitespace-nowrap text-muted-foreground/50">—</div>
                                      )}
                                    </div>
                                    {/* Participants Cell - Updated gap */}
                                    <div className={cn(
                                      "col-span-4 px-6 py-3.5 h-14 flex items-center text-sm border-b border-border/20 overflow-x-auto scrollbar-thin"
                                    )}>
                                      <div className="flex items-center gap-4 whitespace-nowrap">
                                        {interview.participants?.split(',').filter(p => p.trim()).map((participant, i) => (
                                          <div key={i} className="flex items-center gap-1.5 flex-shrink-0" title={participant.trim()}>
                                            <Avatar className="h-6 w-6 border border-border/40">
                                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                {getInitials(participant.trim())}
                                              </AvatarFallback>
                                            </Avatar>
                                            <span className="text-muted-foreground">
                                              {participant.trim()}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </Link>
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
    </div>
  )
}

