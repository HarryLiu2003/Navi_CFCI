"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, Send } from "lucide-react"
import ReactFlow, { Controls, Background } from "reactflow"
import "reactflow/dist/style.css"

// Mock data
const interviewData = {
  interviewer: "Nicholas Piazza",
  interviewee: "Sarah Chen",
  date: "2023-06-15",
  time: "14:30",
  transcript: `WEBVTT

1
00:00:00.000 --> 00:00:03.930
Nicholas Piazza: Hi Sarah, can you hear me okay?

...

6
00:00:42.800 --> 00:01:12.450
Sarah Chen: Sure. So during shift change, we have to manage about 24 patients in our unit, all on continuous cardiac monitoring. We're using your CardioWatch system for most patients, and some are also on the older ECG units. <span className="bg-yellow-200">The main challenge is that these don't talk to each other well. When we're handing off patients, we have to log into multiple systems to get a complete picture of a patient's cardiac status over the past 12 hours.</span>

7
00:01:13.000 --> 00:01:20.200
Nicholas Piazza: Could you give me a specific example of what that workflow looks like?

8
00:01:20.700 --> 00:02:00.300
Sarah Chen: Yes, let me walk you through what happened just this morning. We had a patient who showed some arrhythmia on the CardioWatch around 3 AM. The night nurse had to document this in our EMR, but when we tried to pull up the specific waveform during rounds, we had to switch to your separate CardioAnalytics portal. Then, because this patient also had a 12-lead ECG done at 6 AM, that data was in yet another system. <span className="bg-yellow-200">It took us about 15 minutes just to piece together the complete cardiac event timeline for one patient.</span>

9
00:02:00.800 --> 00:02:10.200
Nicholas Piazza: That sounds frustrating. How often do you need to cross-reference data between these different systems?

10
00:02:10.700 --> 00:02:45.400
Sarah Chen: Multiple times every shift. And it's not just about viewing the data - it's about the alerts too. <span className="bg-yellow-200">The CardioWatch will send alerts to our phones, but the ECG system only shows alerts on the central station monitor. Sometimes we get duplicate alerts, sometimes we miss alerts because they're only showing in one system.</span> Our newer nurses especially struggle with this because they have to learn multiple systems just to monitor one patient's cardiac status.

...

46
00:20:00.700 --> 00:20:05.900
Sarah Chen: You're welcome! Looking forward to seeing what solutions you come up with.`,
  summary:
    "This interview highlights the challenges faced by CCU nurses in managing multiple cardiac monitoring systems. Key issues include system integration, alert management, and workflow inefficiencies.",
  painPoints: [
    {
      id: 1,
      title: "System Integration",
      description: "Multiple systems don't communicate well, requiring manual data compilation.",
    },
    {
      id: 2,
      title: "Alert Management",
      description: "Inconsistent alerts across systems leading to potential missed or duplicate notifications.",
    },
  ],
  keyDemands: [
    { id: 1, title: "Unified System", description: "A single integrated system for all cardiac monitoring needs." },
    {
      id: 2,
      title: "Improved Mobile Functionality",
      description: "Better mobile access with consistent login and full feature set.",
    },
  ],
  userBehavior: {
    context: "Nurses are constantly switching between systems and manually compiling data from multiple sources.",
  },
  satisfaction: 2,
  teamNotes: [
    {
      id: 1,
      user: "Product Team",
      team: "Product",
      note: "Need to prioritize system integration and unified alert management.",
    },
    {
      id: 2,
      user: "UX Team",
      team: "Design",
      note: "Should focus on streamlining the data compilation process and improving mobile experience.",
    },
  ],
}

export default function InterviewPage() {
  const [newNote, setNewNote] = useState("")

  const highlightKeyPoints = (text: string) => {
    return text.replace(
      /<span className="bg-yellow-200">(.*?)<\/span>/g,
      '<span style="background-color: yellow;">$1</span>',
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Link href="/" className="inline-block mb-4">
        <Button variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </Link>

      <h1 className="text-3xl font-bold">Interview Details</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Interview Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <strong>Interviewer:</strong> {interviewData.interviewer}
              </p>
              <p>
                <strong>Interviewee:</strong> {interviewData.interviewee}
              </p>
              <p>
                <strong>Date:</strong> {interviewData.date}
              </p>
              <p>
                <strong>Time:</strong> {interviewData.time}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{interviewData.summary}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <p
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: highlightKeyPoints(interviewData.transcript),
              }}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pain Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {interviewData.painPoints.map((point) => (
                <Card key={point.id} className="w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{point.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p>{point.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Demands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {interviewData.keyDemands.map((demand) => (
                <Link href="/key-feature" key={demand.id} passHref>
                  <Card className="w-full cursor-pointer hover:bg-muted transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{demand.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p>{demand.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Behavior</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">{interviewData.userBehavior.context}</p>
          <div style={{ height: "200px", width: "100%" }}>
            <ReactFlow
              nodes={[
                {
                  id: "1",
                  position: { x: 0, y: 100 },
                  data: { label: "Start" },
                  type: "input",
                  sourcePosition: "right",
                  targetPosition: "left",
                },
                {
                  id: "2",
                  position: { x: 200, y: 100 },
                  data: { label: "Search for Product" },
                  sourcePosition: "right",
                  targetPosition: "left",
                },
                {
                  id: "3",
                  position: { x: 400, y: 100 },
                  data: { label: "Compare Options" },
                  style: { background: "#FFCCCB", borderColor: "#FF0000" },
                  sourcePosition: "right",
                  targetPosition: "left",
                },
                {
                  id: "4",
                  position: { x: 600, y: 100 },
                  data: { label: "Purchase" },
                  type: "output",
                  sourcePosition: "right",
                  targetPosition: "left",
                },
              ]}
              edges={[
                { id: "e1-2", source: "1", target: "2", type: "smoothstep" },
                { id: "e2-3", source: "2", target: "3", type: "smoothstep" },
                { id: "e3-4", source: "3", target: "4", type: "smoothstep" },
              ]}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current User Satisfaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            {["😢", "😕", "😐", "🙂", "😄"].map((emoji, index) => (
              <span
                key={index}
                className={`text-4xl ${index + 1 === interviewData.satisfaction ? "opacity-100" : "opacity-30"}`}
              >
                {emoji}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] mb-4">
            {interviewData.teamNotes.map((note) => (
              <div key={note.id} className="flex items-start space-x-2 mb-4">
                <Avatar>
                  <AvatarFallback>{note.user[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {note.user} ({note.team})
                  </p>
                  <p>{note.note}</p>
                </div>
              </div>
            ))}
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex space-x-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="flex-grow"
            />
            <Button size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

