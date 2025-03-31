"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronLeft, ChevronDown, ChevronUp, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useRouter } from 'next/navigation'
import { toast } from "sonner"
import type { AnalysisResponse } from '@/lib/api'

// Define our extended types
interface TranscriptChunk {
  chunk_number: number;
  speaker: string;
  text: string;
}

interface Excerpt {
  text?: string;
  quote?: string;
  categories: string[];
  insight_summary?: string;
  insight?: string;
  chunk_number: number;
  // transcript_reference is deprecated and being phased out
  transcript_reference?: string;
}

interface ProblemArea {
  problem_id: string;
  title: string;
  description: string;
  excerpts: Excerpt[];
}

interface AnalysisData {
  problem_areas: ProblemArea[];
  synthesis: string | {
    background: string;
    problem_areas: string[];
    next_steps: string[];
  };
  metadata: {
    transcript_length: number;
    problem_areas_count: number;
    excerpts_count?: number;
    excerpts_total_count?: number;
    total_chunks?: number;
  };
  transcript?: TranscriptChunk[];
}

// Update the categoryColors object with the backend categories
const categoryColors = {
  "Current Approach": "bg-blue-100 text-blue-800 border-blue-200",
  "Pain Point": "bg-red-100 text-red-800 border-red-200",
  "Ideal Solution": "bg-green-100 text-green-800 border-green-200",
  "Impact": "bg-purple-100 text-purple-800 border-purple-200"
} as const;

export default function InterviewAnalysisPage() {
  const router = useRouter()
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [activeChunk, setActiveChunk] = useState<number | null>(null)
  const [expandedProblemIds, setExpandedProblemIds] = useState<string[]>([])
  const chunkRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    // Get analysis data from localStorage
    try {
      const savedData = localStorage.getItem('interviewAnalysis');
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Make sure the data has the required structure
        if (!parsedData.problem_areas || !Array.isArray(parsedData.problem_areas)) {
          // Keep this error log as it's genuinely useful for error diagnosis
          console.error('Invalid data structure - problem_areas missing or not an array');
          return;
        }
        
        // Map the excerpt fields if they don't match what the component expects
        const processedData: AnalysisData = {
          ...parsedData,
          // Ensure synthesis is always present and in the expected format
          synthesis: parsedData.synthesis || "No synthesis available",
          problem_areas: parsedData.problem_areas.map((problem: any) => ({
            ...problem,
            excerpts: (problem.excerpts || []).map((excerpt: any) => ({
              ...excerpt,
              // Ensure required fields are present
              quote: excerpt.text || excerpt.quote || "", // Use text if quote is not available
              insight: excerpt.insight_summary || excerpt.insight || "" // Use insight_summary if insight is not available
            }))
          }))
        };
        
        setAnalysisData(processedData);
      } else {
        // Keep this error log as it's genuinely useful for error diagnosis
        console.error('No analysis data found in localStorage');
        // If no data, redirect back to dashboard after a delay
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    } catch (error) {
      // Keep this error log as it's genuinely useful for error diagnosis
      console.error('Error loading analysis data:', error);
      // If error parsing, redirect back to dashboard
      toast.error('Error loading analysis data');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  }, [router]);

  if (!analysisData) {
    return <div>Loading...</div>
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
    if (chunkRefs.current[chunkNumber]) {
      chunkRefs.current[chunkNumber]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }

  // Ensure the transcript is correctly structured
  const transcript = analysisData.transcript || [
    { chunk_number: 1, speaker: "Loading...", text: "Transcript not available" }
  ];

  // Get the metadata fields safely
  const excerptCount = analysisData.metadata.excerpts_count || 
                       analysisData.metadata.excerpts_total_count || 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="inline-block">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Interview Analysis</h1>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" /> Upload New Transcript
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {typeof analysisData.synthesis === 'string' ? (
            // If synthesis is a string, split it into paragraphs
            analysisData.synthesis.split('\n\n').map((paragraph: string, index: number) => (
              <p key={index} className="mb-4">{paragraph}</p>
            ))
          ) : (
            // If synthesis is a structured object
            <div className="space-y-4">
              {/* Render background as paragraphs if it exists */}
              {analysisData.synthesis.background && (
                <div className="mb-6">
                  {analysisData.synthesis.background.split('\n\n').map((paragraph: string, index: number) => (
                    <p key={`bg-${index}`} className="mb-4">{paragraph}</p>
                  ))}
                </div>
              )}
              
              {/* Render problem areas list if it exists */}
              {analysisData.synthesis.problem_areas && analysisData.synthesis.problem_areas.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Key Problem Areas</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {analysisData.synthesis.problem_areas.map((item: string, index: number) => (
                      <li key={`prob-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Render next steps list if it exists */}
              {analysisData.synthesis.next_steps && analysisData.synthesis.next_steps.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Recommended Next Steps</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {analysisData.synthesis.next_steps.map((item: string, index: number) => (
                      <li key={`next-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Transcript */}
        <Card className="h-[calc(100vh-200px)]">
          <CardHeader>
            <CardTitle>Interview Transcript</CardTitle>
            <CardDescription>Full conversation between interviewer and participant</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="p-4 space-y-4">
                {transcript.map((chunk: TranscriptChunk) => (
                  <div
                    key={chunk.chunk_number}
                    ref={(el: HTMLDivElement | null) => {
                      chunkRefs.current[chunk.chunk_number] = el;
                    }}
                    className={`p-3 rounded-md transition-colors ${
                      activeChunk === chunk.chunk_number ? "bg-yellow-100" : ""
                    }`}
                    id={`chunk-${chunk.chunk_number}`}
                  >
                    <p className="font-semibold mb-1">
                      {chunk.speaker} <span className="text-xs text-muted-foreground">#{chunk.chunk_number}</span>
                    </p>
                    <p>{chunk.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right column: Problem Areas */}
        <Card className="h-[calc(100vh-200px)]">
          <CardHeader>
            <CardTitle>Problem Areas</CardTitle>
            <CardDescription>
              {analysisData.metadata.problem_areas_count} problem areas identified with{" "}
              {analysisData.metadata.excerpts_count || analysisData.metadata.excerpts_total_count || 0} supporting excerpts
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="p-4 space-y-4">
                {analysisData.problem_areas.map((problem) => (
                  <Card key={problem.problem_id} className="border-l-4 border-primary">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{problem.title}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleProblemExpansion(problem.problem_id)}
                          className="h-8 w-8 p-0"
                        >
                          {expandedProblemIds.includes(problem.problem_id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <CardDescription className="mt-2">{problem.description}</CardDescription>
                    </CardHeader>

                    {expandedProblemIds.includes(problem.problem_id) && (
                      <CardContent className="p-4 pt-0">
                        <Separator className="my-4" />
                        <h4 className="font-medium mb-3">Supporting Excerpts</h4>
                        <div className="space-y-4">
                          {problem.excerpts.map((excerpt, idx) => (
                            <Card key={idx} className="bg-muted/50">
                              <CardContent className="p-3">
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {excerpt.categories.map((category, catIdx) => (
                                    <Badge
                                      key={catIdx}
                                      className={
                                        category in categoryColors
                                          ? categoryColors[category as keyof typeof categoryColors]
                                          : "bg-gray-100 text-gray-800"
                                      }
                                      variant="outline"
                                    >
                                      {category}
                                    </Badge>
                                  ))}
                                </div>
                                <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-sm mb-2">
                                  &quot;{excerpt.quote || excerpt.text}&quot;
                                </blockquote>
                                <p className="text-sm text-muted-foreground mb-2">{excerpt.insight || excerpt.insight_summary}</p>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0 h-auto text-xs"
                                  onClick={() => scrollToChunk(excerpt.chunk_number)}
                                >
                                  View in transcript (#{excerpt.chunk_number})
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

