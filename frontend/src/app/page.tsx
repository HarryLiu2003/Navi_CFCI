"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, PieChart, LineChart } from "@/components/ui/chart"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart2, 
  Users, 
  Zap, 
  Upload, 
  ArrowRight, 
  RefreshCw,
  LayoutGrid,
  LayoutList,
  ChevronRight,
  User,
  Settings,
  LogOut,
  Bell,
  ChevronDown
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'
import { analyzeTranscript, getInterviews, Interview } from '@/lib/api'
import { toast } from 'sonner'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const projects = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedProject, setSelectedProject] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false)
  const [dashboardTab, setDashboardTab] = useState('overview')

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  // Load interviews on component mount if authenticated
  useEffect(() => {
    if (status === "authenticated") {
    fetchInterviews()
    }
  }, [status])

  const fetchInterviews = async () => {
    setIsLoadingInterviews(true)
    console.log("[page.tsx] fetchInterviews started");
    try {
      const response = await getInterviews(5, 0) // Get the 5 most recent interviews
      
      console.log("[page.tsx] Response received from getInterviews:", JSON.stringify(response, null, 2));

      if (response && response.status === 'success' && response.data && Array.isArray(response.data.interviews)) {
        console.log(`[page.tsx] Successfully fetched ${response.data.interviews.length} interviews.`);
        setInterviews(response.data.interviews)
      } else {
        console.error('[page.tsx] Failed to fetch interviews or data structure is incorrect:', response);
        if (!response) {
           console.error('[page.tsx] Reason: Response object was null or undefined.');
        } else if (response.status !== 'success') {
           console.error(`[page.tsx] Reason: Response status was not 'success' (was '${response.status}'). Message: ${response.message}`);
        } else if (!response.data) {
           console.error('[page.tsx] Reason: response.data is missing.');
        } else if (!Array.isArray(response.data.interviews)) {
            console.error('[page.tsx] Reason: response.data.interviews is not an array.');
        }        
        setInterviews([])
      }
    } catch (error) {
      console.error('[page.tsx] Error fetching interviews:', error);
      setInterviews([])
    } finally {
      setIsLoadingInterviews(false)
      console.log("[page.tsx] fetchInterviews finished");
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.name.endsWith(".vtt") || file.name.endsWith(".txt"))) {
      setSelectedFile(file)
    } else {
      alert("Please select a .vtt or .txt file")
      event.target.value = ""
      setSelectedFile(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }

    setIsAnalyzing(true)
    toast.loading('Analyzing transcript...', { id: 'analysis' })

    try {
      // Pass the user ID from the session to the API
      const result = await analyzeTranscript(selectedFile, session?.user?.id)
      
      // Check if we have a valid response
      if (!result || !result.data) {
        toast.error('Invalid response received from the server', { id: 'analysis' })
        return
      }
      
      // Store the analysis result and navigate immediately
      localStorage.setItem('interviewAnalysis', JSON.stringify(result.data))
      toast.success('Analysis complete', { id: 'analysis' })
      
      // Refresh the interviews list after successful analysis
      fetchInterviews()
      
      // Check if we have the interview ID in the storage data
      if (result.data.storage && result.data.storage.id) {
        // Navigate to the specific interview page using the ID
        router.push(`/interview-analysis/${result.data.storage.id}`)
      } else {
        // Fallback to the main interview analysis page if ID is not available
        console.error("[page.tsx] Analysis successful but storage.id missing. Response data:", JSON.stringify(result, null, 2));
        router.push('/interview-analysis')
      }
      
    } catch (error) {
      // Extract the error message
      let errorMessage = 'Failed to analyze transcript'
      
      if (error instanceof Error) {
        errorMessage = error.message
        // If the error message is too long, truncate it
        if (errorMessage.length > 100) {
          errorMessage = errorMessage.substring(0, 100) + '...'
        }
      }
      
      toast.error(errorMessage, { id: 'analysis' })
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Function to format date to a human-readable format
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
      })
    } catch (e) {
      return 'Unknown date'
    }
  }

  // Show loading state while checking authentication
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

  // If not authenticated, don't render anything as useEffect will redirect
  if (status === "unauthenticated") {
    return null
  }

  // Get user's initials for avatar
  const getInitials = () => {
    if (!session?.user?.name) return "U"
    return session.user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Fixed header with welcome message and account */}
      <div className="px-4 md:px-6 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <h1 className="text-lg font-semibold">Navi ProductForce</h1>
          
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8">
                  <Upload className="mr-2 h-4 w-4" /> Upload Transcript
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Upload Interview Transcript</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
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
                      Upload a VTT or TXT format transcript file for analysis.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project">Project (Optional)</Label>
                    <Select
                      value={selectedProject}
                      onValueChange={setSelectedProject}
                      disabled={isAnalyzing}
                    >
                      <SelectTrigger id="project">
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            Project {project.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      'Analyze Transcript'
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
            </Button>
            
            {/* User account dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{session?.user?.name || "User"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/auth/signin" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Welcome and dashboard sections */}
      <div className="px-4 md:px-8 pt-5 pb-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="mb-5">
            <h1 className="text-2xl font-bold">Welcome to Navi ProductForce</h1>
            <p className="text-muted-foreground mt-1">Your centralized dashboard for product research insights</p>
          </div>

          <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none pb-0 mb-4">
              <TabsTrigger value="overview" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Overview</TabsTrigger>
              <TabsTrigger value="interviews" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Recent Interviews</TabsTrigger>
              <TabsTrigger value="projects" className="rounded-b-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Projects</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content area with tabs */}
      <div className="flex-1 overflow-hidden px-4 md:px-8 pb-6">
        <div className="max-w-7xl mx-auto h-full">
          <ScrollArea className="h-full">
            {dashboardTab === 'overview' && (
              <div className="space-y-6 pb-6">
                {/* Key metrics section */}
                <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                  <Link href="/project-list" passHref>
                    <Card className="cursor-pointer hover:border-primary/50 transition-all shadow-sm">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <BarChart2 className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">6</div>
                        <p className="text-xs text-muted-foreground">Across all teams</p>
                      </CardContent>
                    </Card>
                  </Link>
                  <Card className="hover:border-primary/50 transition-all shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Interviews</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">24</div>
                      <p className="text-xs text-muted-foreground">8 scheduled for this week</p>
                    </CardContent>
                  </Card>
                  <Card className="hover:border-primary/50 transition-all shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Key Demands</CardTitle>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">86</div>
                      <p className="text-xs text-muted-foreground">14 new this month</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                  <Card className="col-span-4 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Project Overview</CardTitle>
                      <CardDescription>Key demand distribution by project</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BarChart
                        data={[
                          { name: "Project A", total: 12 },
                          { name: "Project B", total: 8 },
                          { name: "Project C", total: 15 },
                          { name: "Project D", total: 6 },
                          { name: "Project E", total: 10 },
                        ]}
                        index="name"
                        categories={["total"]}
                        colors={["#3b82f6"]}
                        valueFormatter={(value: number) => `${value} demands`}
                        yAxisWidth={48}
                      />
                    </CardContent>
                  </Card>
                  <Card className="col-span-3 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Demand Distribution</CardTitle>
                      <CardDescription>Current scope vs. new demands</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PieChart
                        data={[
                          { name: "Defined Scope", value: 60 },
                          { name: "New Demand", value: 40 },
                        ]}
                        index="name"
                        categories={["value"]}
                        colors={["#0ea5e9", "#6366f1"]}
                        valueFormatter={(value: number) => `${value}%`}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Team Activity section */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Team Activity</CardTitle>
                    <CardDescription>Progress across different teams</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="all">
                      <TabsList>
                        <TabsTrigger value="all">All Teams</TabsTrigger>
                        <TabsTrigger value="product">Product</TabsTrigger>
                        <TabsTrigger value="sales">Sales & Marketing</TabsTrigger>
                        <TabsTrigger value="rd">R&D</TabsTrigger>
                      </TabsList>
                      <TabsContent value="all" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">Overall Progress</p>
                            <p className="text-sm text-muted-foreground">Across all teams</p>
                          </div>
                          <div className="font-bold">78%</div>
                        </div>
                        <Progress value={78} className="h-2" />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Demand Trend</CardTitle>
                    <CardDescription>Key demands identified over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LineChart
                      data={[
                        { date: "2023-01-01", demands: 10 },
                        { date: "2023-02-01", demands: 15 },
                        { date: "2023-03-01", demands: 25 },
                        { date: "2023-04-01", demands: 30 },
                        { date: "2023-05-01", demands: 45 },
                        { date: "2023-06-01", demands: 60 },
                      ]}
                      index="date"
                      categories={["demands"]}
                      colors={["#3b82f6"]}
                      valueFormatter={(value: number) => `${value} demands`}
                      yAxisWidth={40}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {dashboardTab === 'interviews' && (
              <div className="space-y-6 pb-6">
                {/* Recent Interviews section */}
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base">Recent Interviews</CardTitle>
                      <CardDescription>Latest user interviews and their key insights</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-8" onClick={fetchInterviews} disabled={isLoadingInterviews}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingInterviews ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {isLoadingInterviews ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : interviews.length > 0 ? (
                        <div>
                          {interviews.map((interview, index) => (
                            <div key={interview.id}>
                              <div className="flex items-center space-x-4 py-3">
                                <Avatar className="h-10 w-10 border shadow-sm">
                                  <AvatarFallback>
                                    {interview.title?.charAt(0).toUpperCase() || 'I'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                  <p className="text-sm font-medium leading-none">{interview.title || 'Untitled Interview'}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Uploaded on {formatDate(interview.created_at)}
                                    {interview.interviewer && ` by ${interview.interviewer}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {interview.problem_count} problem areas, {interview.transcript_length} transcript chunks
                                  </p>
                                </div>
                                <Link href={`/interview-analysis/${interview.id}`} className="no-underline">
                                  <Button variant="ghost" size="sm" className="h-8">
                                    View <ChevronRight className="ml-1 h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                              {index < interviews.length - 1 && <Separator />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No interviews found. Upload a transcript to get started.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {dashboardTab === 'projects' && (
              <div className="space-y-6 pb-6">
                {/* Quick access to projects */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Your Projects</h3>
                  <Link href="/project-list">
                    <Button variant="outline" size="sm">
                      View All Projects <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Card key={project.id} className="shadow-sm hover:border-primary/50 transition-all">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Project {project.id}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">Project description goes here.</p>
                        <div className="flex justify-between items-center">
                          <Badge variant="outline">In Progress</Badge>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/project-list">Details</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

