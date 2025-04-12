"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
} from "lucide-react"
import Link from "next/link"
import { getInterviewById, updateInterview, getAllPersonas, getProjects } from '@/lib/api'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChangeProjectModal } from '@/components/dialogs/ChangeProjectModal'
import { Interview, Persona } from '@/lib/api'
import { getPersonaColorById } from '@/lib/constants'

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
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function InterviewAnalysisDetail({ params }: PageProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interview, setInterview] = useState<any>(null)
  const resolvedParams = use(params)
  
  const { data: session, status } = useSession();
  
  // State for inline title editing
  const [currentTitle, setCurrentTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [saveError, setSaveError] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null); // Ref for the h1 element
  
  // View mode state: 'tabs' or 'split'
  const [viewMode, setViewMode] = useState<'tabs' | 'split'>('tabs')
  
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return; 
    }

    if (status === "authenticated") {
      const fetchInterviewAndData = async () => {
        try {
          setIsLoading(true)
          setError(null)
          setPersonasError(null)
          
          // Fetch interview and projects data in parallel
          const [interviewResponse, projectsResponse] = await Promise.all([
            getInterviewById(resolvedParams.id),
            getProjects(100, 0)
          ]);
          
          let fetchedInterview: any = null;
          
          // Handle interview data
          if (interviewResponse.status === "success" && interviewResponse.data) {
            fetchedInterview = interviewResponse.data;
            setInterview(fetchedInterview);
            const initialTitle = fetchedInterview?.title || "Interview Analysis";
            setCurrentTitle(initialTitle);
            setOriginalTitle(initialTitle);
            if (fetchedInterview.analysis_data?.problem_areas?.length > 0) {
              setExpandedProblemIds([fetchedInterview.analysis_data.problem_areas[0].problem_id])
            }
          } else {
            setError(interviewResponse.message || "Failed to load interview data")
          }

          // Handle projects data
          if (projectsResponse.status === 'success') {
            setProjects(projectsResponse.data?.projects || []);
          }

          // --- Check sessionStorage flag --- 
          const flagInterviewId = sessionStorage.getItem('showPersonaModalForInterview');
          let shouldShowModal = false;
          
          if (flagInterviewId && flagInterviewId === resolvedParams.id && fetchedInterview) {
            sessionStorage.removeItem('showPersonaModalForInterview'); 
            const needsPersonaTagging = !fetchedInterview.personas || fetchedInterview.personas.length === 0;
            if (needsPersonaTagging) {
              shouldShowModal = true;
            }
          }
          
          // Fetch personas if needed
          if (shouldShowModal) {
            setIsLoadingPersonas(true);
            try {
              const personasResponse = await getAllPersonas();
              if (personasResponse.status === 'success') {
                setAllPersonas(personasResponse.data || []);
                setShowPersonaModal(true);
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
          console.error("Error fetching data:", fetchError)
          setError(fetchError instanceof Error ? fetchError.message : "An unknown error occurred")
        } finally {
          setIsLoading(false)
        }
      }
      fetchInterviewAndData()
    }
  }, [resolvedParams.id, status, router])

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
  
  // Toggle problem area expansion
  const toggleProblemExpansion = (problemId: string) => {
    setExpandedProblemIds((prev) =>
      prev.includes(problemId) ? prev.filter((id) => id !== problemId) : [...prev, problemId],
    )
  }

  // Scroll to chunk in transcript
  const scrollToChunk = (chunkNumber: number) => {
    setActiveChunk(chunkNumber)
    
    // If in tabs mode, switch to transcript tab
    if (viewMode === 'tabs') {
      setActiveTab('transcript')
    }
    
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      if (chunkRefs.current[chunkNumber]) {
        chunkRefs.current[chunkNumber]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }
    }, 100)
  }

  // --- Helper Functions --- 
  // Update getInitials for single initial
  const getInitials = (name?: string | null) => {
    // Handle null, undefined, empty, or whitespace-only strings
    if (!name || name.trim().length === 0) return "?"
    // Take the first character of the trimmed string and uppercase it
    return name.trim()[0].toUpperCase();
  }

  // --- Callback for Persona Modal Save ---
  const handlePersonaSaveSuccess = useCallback((updatedPersonas: Persona[]) => {
    setInterview((prevInterview: Interview | null) => {
      if (!prevInterview) return null;
      return { ...prevInterview, personas: updatedPersonas };
    });
  }, []);

  // --- Callback for Change Project Modal Save (NEW) ---
  const handleProjectChangeSuccess = useCallback((newProjectId: string | undefined) => {
    setInterview((prevInterview: Interview | null) => {
        if (!prevInterview) return null;
        // Find the project object from the fetched list to update the nested data if needed
        const newProject = projects.find(p => p.id === newProjectId);
        return {
            ...prevInterview, 
            project_id: newProjectId,
            project: newProject || null // Update the nested project data or set to null
        };
    });
  }, [projects]); // Depend on projects list so newProject is updated correctly

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

  // Extract analysis data
  const analysis = interview.analysis_data || {}
  const problemAreas = analysis.problem_areas || []
  const synthesis = analysis.synthesis || ""
  const metadata = analysis.metadata || {}
  const transcript = analysis.transcript || []
  
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

  // Render the problem areas content
  const renderProblemAreas = () => (
    <div className="space-y-5 px-4">
      {problemAreas.length > 0 ? (
        problemAreas.map((problem: any, index: number) => (
          <Card key={problem.problem_id || index} className="border-l-4 border-primary/70 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-medium text-foreground/90 flex items-center">
                  <span className="bg-muted text-muted-foreground rounded-md w-6 h-6 inline-flex items-center justify-center text-sm mr-2 shadow-sm">
                    {index + 1}
                  </span>
                  {problem.title}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleProblemExpansion(problem.problem_id)}
                  className="h-7 w-7 p-0"
                >
                  {expandedProblemIds.includes(problem.problem_id) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <CardDescription className="mt-2 text-sm leading-relaxed text-muted-foreground/90">
                {problem.description}
              </CardDescription>
            </CardHeader>

            {expandedProblemIds.includes(problem.problem_id) && (
              <CardContent className="p-4 pt-0">
                <Separator className="my-3" />
                <h4 className="text-sm font-medium mb-3">Supporting Excerpts</h4>
                <div className="space-y-4">
                  {problem.excerpts && problem.excerpts.map((excerpt: any, i: number) => (
                    <Card key={i} className="bg-muted/30 border shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex flex-wrap gap-1 mb-2">
                          {excerpt.categories && excerpt.categories.map((category: string, catIdx: number) => (
                            <Badge
                              key={catIdx}
                              className={`text-xs ${
                                category in categoryColors
                                  ? categoryColors[category as keyof typeof categoryColors]
                                  : "bg-gray-100 text-gray-800"
                              }`}
                              variant="outline"
                            >
                              {category}
                            </Badge>
                          ))}
                        </div>
                        <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-sm mb-2 text-foreground/80">
                          &quot;{excerpt.quote || excerpt.text}&quot;
                        </blockquote>
                        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                          {excerpt.insight || excerpt.insight_summary}
                        </p>
                        {excerpt.chunk_number && (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto text-xs"
                            onClick={() => scrollToChunk(excerpt.chunk_number)}
                          >
                            View in transcript (#{excerpt.chunk_number})
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))
      ) : (
        <div className="text-center py-10">
          <p className="text-muted-foreground">No problem areas identified in this interview.</p>
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
            ref={(el) => {
              chunkRefs.current[chunk.chunk_number] = el;
            }}
            className={`p-3 rounded-md transition-colors border border-border/40 hover:bg-muted/30 ${
              activeChunk === chunk.chunk_number ? "bg-yellow-100/80 !border-yellow-300" : ""
            }`}
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
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground/90">{chunk.speaker}</p>
                  <Badge variant="outline" className="text-[10px] font-normal px-1 py-0 h-4">
                    {chunk.chunk_number}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{chunk.text}</p>
              </div>
            </div>
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
            {/* Left Side: Back Button */}
            <div className="justify-self-start">
              <Button variant="outline" size="sm" className="h-8" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
          </Button>
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
      {/* == Homepage Header END == */}

      {/* == Main Content Area == */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-4 md:px-6 py-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Title and Core Info Section */}
              <div className="space-y-4">
                {/* Title with Edit */}
                <div className="flex items-center gap-2"> 
                  <div className="flex-1 relative">
                    <h1 
                      ref={titleRef} 
                      contentEditable
                      suppressContentEditableWarning={true} 
                      onInput={handleTitleInput} 
                      onBlur={handleTitleBlur} 
                      onKeyDown={handleTitleKeyDown} 
                      className="text-xl font-semibold tracking-tight px-1 cursor-text outline-none transition-colors hover:bg-muted/40 rounded-sm"
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
                      {interview?.interviewer && (
                        <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground/90">
                          <Mic className="h-3.5 w-3.5" />
                          <span>{interview.interviewer}</span>
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
                      <div 
                        className={cn(
                          "rounded-sm px-2.5 py-1.5 cursor-pointer transition-colors text-sm border",
                          interview?.project_id 
                            ? "bg-muted/40 border-muted/50 text-foreground hover:bg-muted/60" 
                            : "bg-muted/40 border-muted/50 text-muted-foreground hover:bg-muted/60"
                        )}
                        onClick={() => setShowChangeProjectModal(true)}
                      >
                        {projects.find(p => p.id === interview?.project_id)?.name || "No project assigned"}
                      </div>
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
                {viewMode === 'tabs' ? (
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
                    <div className="flex-1 overflow-hidden">
                      <TabsContent value="problems" className="h-full overflow-hidden mt-0 pt-0">
                        <Card className="h-full">
                          <CardHeader className="pb-3">
                                  {/* Consistent Card Title Style */} 
                                  <CardTitle className="text-lg font-semibold">Problem Areas</CardTitle> 
                                  <CardDescription className="text-sm text-muted-foreground/90 mt-1">
                                Key issues identified from the interview
                              </CardDescription>
                          </CardHeader>
                          <CardContent className="p-0 h-[calc(100%-5rem)] overflow-hidden">
                            <ScrollArea className="h-full">
                              <div className="pb-4">
                                {renderProblemAreas()}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </TabsContent>
                      <TabsContent value="transcript" className="h-full overflow-hidden mt-0 pt-0">
                        <Card className="h-full flex flex-col">
                          <CardHeader className="flex-shrink-0 pb-3">
                                  {/* Consistent Card Title Style */} 
                                  <CardTitle className="text-lg font-semibold">Interview Transcript</CardTitle> 
                                  <CardDescription className="text-sm text-muted-foreground/90 mt-1">
                                Full transcript of the interview conversation
                              </CardDescription>
                          </CardHeader>
                          <CardContent className="flex-1 min-h-0 p-0">
                            <ScrollArea className="h-full">
                              <div className="pb-3">
                                {renderTranscript()}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </div>
                  </Tabs>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                    {/* Left column: Transcript */}
                    <Card className="h-full overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <div>
                                  {/* Consistent Card Title Style */} 
                                  <CardTitle className="text-lg font-semibold">Interview Transcript</CardTitle> 
                                  <CardDescription className="text-sm text-muted-foreground/90 mt-1">
                                Full conversation
                              </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 h-[calc(100%-5rem)] overflow-hidden">
                        <ScrollArea className="h-full">
                          <div className="pb-3">
                            {renderTranscript()}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Right column: Problem Areas */}
                    <Card className="h-full overflow-hidden">
                      <CardHeader className="pb-3">
                              {/* Consistent Card Title Style */} 
                              <CardTitle className="text-lg font-semibold">Problem Areas</CardTitle> 
                              <CardDescription className="text-sm text-muted-foreground/90 mt-1">
                                Key issues identified from the interview
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 h-[calc(100%-5rem)] overflow-hidden">
                        <ScrollArea className="h-full">
                          <div className="pb-4">
                            {renderProblemAreas()}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </section>
            </div> {/* End max-w-7xl */} 
          </div> {/* End padding div */} 
        </ScrollArea> {/* End main ScrollArea */} 
      </div> {/* End flex-1 div */} 

      {/* == Persona Tagging Modal == */} 
      {interview && (
         <PersonaTaggingModal
            open={showPersonaModal}
            onOpenChange={setShowPersonaModal}
            interviewId={resolvedParams.id}
            initialPersonas={interview?.personas || []} 
            allPersonas={allPersonas} 
            onSaveSuccess={handlePersonaSaveSuccess}
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
      
    </div> // End root div
  )
} 