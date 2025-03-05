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
import type { AnalysisResponse } from '@/lib/api'

// Add these type definitions at the top of the file, after the imports
// type CategoryColor = {
//   [K in keyof typeof categoryColors]: string;
// };

// type ChunkRef = {
//   [key: number]: HTMLDivElement | null;
// };

// Update the categoryColors object with all possible categories
const categoryColors = {
  "Current Approach": "bg-blue-100 text-blue-800",
  "Pain Point": "bg-red-100 text-red-800",
  "Ideal Solution": "bg-green-100 text-green-800",
  "Impact": "bg-purple-100 text-purple-800",
  "Vague Problem Definition": "bg-yellow-100 text-yellow-800",
  // Keep existing categories if needed
  Collaboration: "bg-indigo-100 text-indigo-800",
  Communication: "bg-emerald-100 text-emerald-800",
  Attitude: "bg-amber-100 text-amber-800",
  "Problem-Solving": "bg-rose-100 text-rose-800",
  "Stress Management": "bg-violet-100 text-violet-800",
  "Decision-Making": "bg-orange-100 text-orange-800",
} as const;

export default function InterviewAnalysisPage() {
  const router = useRouter()
  const [analysisData, setAnalysisData] = useState<AnalysisResponse['data'] | null>(null)
  const [activeChunk, setActiveChunk] = useState<number | null>(null)
  const [expandedProblemIds, setExpandedProblemIds] = useState<string[]>([])
  const chunkRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    // Get analysis data from localStorage
    const savedData = localStorage.getItem('interviewAnalysis')
    if (savedData) {
      setAnalysisData(JSON.parse(savedData))
    } else {
      // If no data, redirect back to dashboard
      router.push('/')
    }
  }, [router])

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

  return (
    <div className="container mx-auto p-6 space-y-6">
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
            analysisData.synthesis.split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4">{paragraph}</p>
            ))
          ) : (
            <>
              {Object.values(analysisData.synthesis)
                .filter(paragraph => paragraph) // Filter out any null/undefined values
                .map((paragraph, index) => (
                  <p key={index} className="mb-4 whitespace-pre-wrap">{
                    typeof paragraph === 'string' 
                      ? paragraph 
                      : JSON.stringify(paragraph, null, 2)
                  }</p>
                ))}
            </>
          )}
          <div className="mt-4 flex gap-4">
            <div>
              <strong>Problem Areas:</strong> {analysisData.metadata.problem_areas_count}
            </div>
            <div>
              <strong>Total Excerpts:</strong> {analysisData.metadata.excerpts_total_count}
            </div>
          </div>
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
                {transcript.map((chunk) => (
                  <div
                    key={chunk.chunk_number}
                    ref={(el: HTMLDivElement | null) => {
                      chunkRefs.current[chunk.chunk_number] = el;
                    }}
                    className={`p-3 rounded-md transition-colors ${
                      activeChunk === chunk.chunk_number ? "bg-yellow-100 dark:bg-yellow-900/30" : ""
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
              {analysisData.metadata.excerpts_total_count} supporting excerpts
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
                                  &quot;{excerpt.quote}&quot;
                                </blockquote>
                                <p className="text-sm text-muted-foreground mb-2">{excerpt.insight}</p>
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

