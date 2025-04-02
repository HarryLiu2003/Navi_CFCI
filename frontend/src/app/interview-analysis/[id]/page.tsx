"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
  Lightbulb
} from "lucide-react"
import Link from "next/link"
import { getInterviewById } from '@/lib/api'
import { toast } from 'sonner'
import { use } from 'react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await getInterviewById(resolvedParams.id)
        
        if (response.status === "success" && response.data) {
          setInterview(response.data)
          // Expand the first problem area by default
          if (response.data.analysis_data?.problem_areas?.length > 0) {
            setExpandedProblemIds([response.data.analysis_data.problem_areas[0].problem_id])
          }
        } else {
          setError("Failed to load interview data")
        }
      } catch (error) {
        console.error("Error fetching interview:", error)
        setError(error instanceof Error ? error.message : "An unknown error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchInterview()
  }, [resolvedParams.id])

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

  if (isLoading) {
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
          <Card key={problem.problem_id || index} className="border-l-4 border-primary shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 inline-flex items-center justify-center text-sm mr-2 shadow-sm">
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
              <CardDescription className="mt-2 text-sm leading-relaxed">
                {problem.description}
              </CardDescription>
            </CardHeader>

            {expandedProblemIds.includes(problem.problem_id) && (
              <CardContent className="p-4 pt-0">
                <Separator className="my-3" />
                <h4 className="text-sm font-medium mb-3">Supporting Excerpts</h4>
                <div className="space-y-4">
                  {problem.excerpts && problem.excerpts.map((excerpt: any, i: number) => (
                    <Card key={i} className="bg-muted/40 border shadow-sm">
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
            className={`p-3 rounded-md transition-colors ${
              activeChunk === chunk.chunk_number 
                ? "bg-yellow-100/80 border border-yellow-300" 
                : "border border-border/40 hover:bg-muted/30"
            }`}
            id={`chunk-${chunk.chunk_number}`}
          >
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0">
                <Avatar className="h-6 w-6 border shadow-sm">
                  <AvatarFallback className="text-xs">{chunk.speaker?.[0] || '?'}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-foreground/90">{chunk.speaker}</p>
                  <Badge variant="outline" className="text-[10px] font-normal px-1 py-0 h-4">
                    {chunk.chunk_number}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">{chunk.text}</p>
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
      {/* Fixed header */}
      <div className="px-4 md:px-6 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          
          <div className="flex items-center gap-2 ml-auto">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'split' ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => setViewMode('split')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  <p>Split View</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'tabs' ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => setViewMode('tabs')}
                  >
                    <Rows className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  <p>Tab View</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => copyToClipboard(JSON.stringify(analysis, null, 2))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  <p>Copy Analysis JSON</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Summary section - spacious and clean */}
      <div className="px-4 md:px-8 pt-5 pb-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="mb-2">
            <h1 className="text-lg font-semibold mb-2">{interview.title || "Interview Analysis"}</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {interview.interviewer ? `Interviewer: ${interview.interviewer}` : ""}
              {interview.created_at ? ` • ${formatDate(interview.created_at)}` : ""}
            </p>
          </div>
          <p className="text-sm leading-relaxed mb-4 text-foreground/90">
            {typeof synthesis === 'string' ? synthesis : synthesis.background}
          </p>
          
          {typeof synthesis !== 'string' && synthesis.next_steps && synthesis.next_steps.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium mb-2">Next Steps:</p>
              <ul className="text-sm list-disc list-inside space-y-1.5 text-foreground/80">
                {synthesis.next_steps.map((step: string, index: number) => (
                  <li key={index} className="leading-relaxed">{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden px-4 md:px-8 pb-6">
        <div className="max-w-7xl mx-auto h-full">
          {viewMode === 'tabs' ? (
            <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <div className="flex justify-start">
                  <TabsList className="w-auto">
                    <TabsTrigger value="problems">Problem Areas</TabsTrigger>
                    <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  </TabsList>
                </div>
                
                {/* Conditional search input for transcript tab */}
                {activeTab === 'transcript' && (
                  <div className="flex items-center gap-2">
                    {isSearching ? (
                      <div className="relative w-[220px]">
                        <Input
                          id="transcript-search"
                          placeholder="Search transcript..."
                          className="h-8 text-sm"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="absolute right-0 top-0 h-8 w-8 p-0"
                          onClick={() => setSearchQuery("")}
                        >
                          ×
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={toggleSearch}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-hidden">
                <TabsContent value="problems" className="h-full overflow-hidden mt-0 pt-0">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Problem Areas</CardTitle>
                      <CardDescription>
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
                      <CardTitle className="text-base">Interview Transcript</CardTitle>
                      <CardDescription>
                        Full transcript of the interview conversation
                        {filteredTranscript.length !== transcript.length && 
                          ` • Showing ${filteredTranscript.length} of ${transcript.length} chunks`}
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
                      <CardTitle className="text-base">Interview Transcript</CardTitle>
                      <CardDescription>
                        Full conversation
                        {filteredTranscript.length !== transcript.length && 
                          ` • Showing ${filteredTranscript.length} of ${transcript.length}`}
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isSearching ? (
                        <div className="relative w-[180px]">
                          <Input
                            id="transcript-search-split"
                            placeholder="Search transcript..."
                            className="h-8 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="absolute right-0 top-0 h-8 w-8 p-0"
                            onClick={() => setSearchQuery("")}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={toggleSearch}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      )}
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
                  <CardTitle className="text-base">Problem Areas</CardTitle>
                  <CardDescription>
                    {metadata.problem_areas_count || problemAreas.length} problem areas with{" "}
                    {metadata.excerpts_count || metadata.excerpts_total_count || 0} supporting excerpts
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
        </div>
      </div>
    </div>
  )
} 