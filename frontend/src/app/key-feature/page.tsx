"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Send, Star, ChevronLeft } from "lucide-react"

// Mock data for the key feature
const featureData = {
  title: "Simplified Onboarding",
  description: "A step-by-step guided onboarding process to help new users get started quickly and easily.",
  highlightedSegment: {
    text: "The current onboarding process is too complex. Users are getting lost and frustrated before they can even start using the product. We need a simpler, guided approach.",
    interviewId: "interview-123",
    timestamp: "14:23",
  },
  relatedInterviews: [
    { id: "interview-456", title: "Interview with John Doe" },
    { id: "interview-789", title: "Feedback from Jane Smith" },
  ],
  comments: [
    { id: 1, user: "Alice", team: "Product", comment: "This aligns well with our Q3 goals." },
    { id: 2, user: "Bob", team: "Marketing", comment: "This could be a great selling point for new customers." },
  ],
}

export default function KeyFeaturePage({ params }: { params: { id: string } }) {
  const [newComment, setNewComment] = useState("")
  const [teamScores, setTeamScores] = useState({
    Product: 0,
    Marketing: 0,
    "R&D": 0,
    Sales: 0,
  })

  const handleScoreChange = (team: string, score: number) => {
    setTeamScores((prev) => ({ ...prev, [team]: score }))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Link href="/" className="inline-block mb-4">
        <Button variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </Link>

      <h1 className="text-3xl font-bold">{featureData.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{featureData.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Highlighted Interview Segment</CardTitle>
        </CardHeader>
        <CardContent>
          <blockquote className="border-l-4 border-primary pl-4 italic">
            "{featureData.highlightedSegment.text}"
          </blockquote>
          <p className="mt-2">
            <Link
              href={`/interviews/${featureData.highlightedSegment.interviewId}`}
              className="text-primary hover:underline"
            >
              View in interview
            </Link>{" "}
            (Timestamp: {featureData.highlightedSegment.timestamp})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Also seen in</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {featureData.relatedInterviews.map((interview) => (
              <Link href="/interview" key={interview.id} passHref>
                <Card className="cursor-pointer hover:bg-muted transition-colors">
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">{interview.title}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Importance Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(teamScores).map(([team, score]) => (
              <div key={team} className="flex flex-col space-y-2">
                <p className="font-semibold">{team}</p>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      variant="ghost"
                      size="sm"
                      className={`p-0 ${star <= score ? "text-yellow-400" : "text-gray-300"}`}
                      onClick={() => handleScoreChange(team, star)}
                    >
                      <Star className="h-6 w-6 fill-current" />
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] mb-4">
            {featureData.comments.map((comment) => (
              <div key={comment.id} className="flex items-start space-x-2 mb-4">
                <Avatar>
                  <AvatarFallback>{comment.user[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {comment.user} ({comment.team})
                  </p>
                  <p>{comment.comment}</p>
                </div>
              </div>
            ))}
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex space-x-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
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

