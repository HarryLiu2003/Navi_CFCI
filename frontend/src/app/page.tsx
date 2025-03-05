"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { CardDescription } from "@/components/ui/card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, PieChart, LineChart } from "@/components/ui/chart"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BarChart2, Users, Zap, Upload, ArrowRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'
import { analyzeTranscript } from '@/lib/api'
import { toast } from 'sonner'

export default function Home() {
  const router = useRouter()
  const projects = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedProject, setSelectedProject] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [interviewTime, setInterviewTime] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16) // Format: "YYYY-MM-DDTHH:mm"
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.name.endsWith(".vtt")) {
      setSelectedFile(file)
    } else {
      alert("Please select a .vtt file")
      event.target.value = ""
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
      const result = await analyzeTranscript(selectedFile)
      
      if (!result.data) {
        throw new Error('No data received from analysis')
      }
      
      // Store the analysis result in localStorage
      localStorage.setItem('interviewAnalysis', JSON.stringify(result.data))
      
      toast.success('Analysis complete', { id: 'analysis' })
      
      // Add a slight delay before redirect to ensure localStorage is set
      setTimeout(() => {
        router.push('/interview-analysis')
      }, 500)
      
    } catch (error) {
      toast.error('Failed to analyze transcript', { id: 'analysis' })
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header section */}
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-baseline">
          <span className="font-serif italic mr-2">Navi</span>
          <span className="font-sans">
            <span className="font-extrabold">Product</span>
            <span className="font-light">Force</span>
          </span>
        </h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" /> Upload New Transcript
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload New Transcript</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Transcript File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".vtt"
                  onChange={handleFileChange}
                  required
                  disabled={isAnalyzing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <Select
                  disabled={isAnalyzing}
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        Project {project.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Interview Time</Label>
                <Input
                  id="time"
                  type="datetime-local"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  disabled={isAnalyzing}
                />
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
      </header>

      {/* Key metrics section */}
      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/project-list" passHref>
          <Card className="cursor-pointer hover:bg-muted transition-colors">
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
        <Card className="hover:bg-muted transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Interviews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">8 scheduled for this week</p>
          </CardContent>
        </Card>
        <Card className="hover:bg-muted transition-colors">
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
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Project Overview</CardTitle>
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
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Demand Distribution</CardTitle>
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

      {/* Recent Interviews section remains unchanged */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interviews</CardTitle>
          <CardDescription>Latest user interviews and their key insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((interview) => (
              <div key={interview} className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={`/placeholder.svg?height=40&width=40`} alt="User" />
                  <AvatarFallback>U{interview}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">User Interview {interview}</p>
                  <p className="text-sm text-muted-foreground">Conducted on {new Date().toLocaleDateString()}</p>
                </div>
                <Link href="/interview" className="no-underline">
                  <Button variant="ghost">
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Activity section remains unchanged */}
      <Card>
        <CardHeader>
          <CardTitle>Team Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Teams</TabsTrigger>
              <TabsTrigger value="product">Product</TabsTrigger>
              <TabsTrigger value="sales">Sales & Marketing</TabsTrigger>
              <TabsTrigger value="rd">R&D</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">Overall Progress</p>
                  <p className="text-sm text-muted-foreground">Across all teams</p>
                </div>
                <div className="font-bold">78%</div>
              </div>
              <Progress value={78} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demand Trend</CardTitle>
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
  )
}

