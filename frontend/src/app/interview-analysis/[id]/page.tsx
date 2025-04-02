"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, Copy, Download } from "lucide-react"
import Link from "next/link"
import { getInterviewById } from '@/lib/api'
import { toast } from 'sonner'
import { use } from 'react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function InterviewAnalysisDetail({ params }: PageProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interview, setInterview] = useState<any>(null)
  const resolvedParams = use(params)

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await getInterviewById(resolvedParams.id)
        
        if (response.status === "success" && response.data) {
          setInterview(response.data)
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(analysis, null, 2))}>
          <Copy className="h-4 w-4 mr-2" />
          Copy JSON
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{interview.title || "Interview Analysis"}</CardTitle>
            <CardDescription>
              {interview.interviewer ? `Conducted by ${interview.interviewer}` : ""}
              {interview.interview_date ? 
                ` on ${formatDate(interview.interview_date)}` : 
                ` on ${formatDate(interview.created_at)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 mb-6">
              <h3 className="text-sm font-medium">Summary</h3>
              <p className="text-sm">{typeof synthesis === 'string' ? synthesis : synthesis.background}</p>
            </div>
            
            {typeof synthesis !== 'string' && synthesis.next_steps && (
              <div className="space-y-1 mb-6">
                <h3 className="text-sm font-medium">Next Steps</h3>
                <ul className="text-sm list-disc list-inside">
                  {synthesis.next_steps.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Problem Areas</p>
                <p className="text-sm font-medium">{metadata.problem_areas_count || problemAreas.length}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Transcript Length</p>
                <p className="text-sm font-medium">{metadata.transcript_length || transcript.length} chunks</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Excerpts</p>
                <p className="text-sm font-medium">{metadata.excerpts_count || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Interview ID</p>
                <p className="text-sm font-medium truncate max-w-[140px]" title={interview.id}>{interview.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="problems">
        <TabsList>
          <TabsTrigger value="problems">Problem Areas</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>
        
        <TabsContent value="problems" className="mt-6">
          {problemAreas.length > 0 ? (
            <div className="space-y-6">
              {problemAreas.map((problem: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle>{problem.title}</CardTitle>
                    <CardDescription>{problem.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <h3 className="text-sm font-medium mb-4">Supporting Excerpts</h3>
                    <div className="space-y-4">
                      {problem.excerpts && problem.excerpts.map((excerpt: any, i: number) => (
                        <div key={i} className="border rounded-md p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="space-x-1">
                              {excerpt.categories && excerpt.categories.map((category: string, j: number) => (
                                <Badge key={j} variant="secondary">{category}</Badge>
                              ))}
                            </div>
                            {excerpt.chunk_number && (
                              <Badge variant="outline">Chunk {excerpt.chunk_number}</Badge>
                            )}
                          </div>
                          <blockquote className="border-l-2 pl-4 italic mb-2 text-muted-foreground">
                            "{excerpt.text}"
                          </blockquote>
                          <p className="text-sm">{excerpt.insight_summary}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No problem areas identified in this interview.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="transcript" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Interview Transcript</CardTitle>
              <CardDescription>Full transcript of the interview conversation</CardDescription>
            </CardHeader>
            <CardContent>
              {transcript.length > 0 ? (
                <div className="space-y-4">
                  {transcript.map((chunk: any, index: number) => (
                    <div key={index} className="flex space-x-4">
                      <div className="flex-shrink-0">
                        <Avatar>
                          <AvatarFallback>{chunk.speaker?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{chunk.speaker}</p>
                          <Badge variant="outline" className="text-xs">Chunk {chunk.chunk_number}</Badge>
                        </div>
                        <p className="mt-1">{chunk.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Transcript not available for this interview.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 