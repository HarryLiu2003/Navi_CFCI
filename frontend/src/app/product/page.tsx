"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, Calendar, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

// Mock data for recent interviews
const recentInterviews = [
  { id: "1", user: "John Doe", date: "2023-06-15", avatar: "/placeholder.svg?height=40&width=40" },
  { id: "2", user: "Jane Smith", date: "2023-06-14", avatar: "/placeholder.svg?height=40&width=40" },
  { id: "3", user: "Alice Johnson", date: "2023-06-13", avatar: "/placeholder.svg?height=40&width=40" },
  { id: "4", user: "Bob Williams", date: "2023-06-12", avatar: "/placeholder.svg?height=40&width=40" },
]

// Mock data for feature requests
const featureRequests = [
  { id: "1", title: "Dark Mode", mentions: 15, lastMentioned: "2023-06-15" },
  { id: "2", title: "Integration with Slack", mentions: 12, lastMentioned: "2023-06-14" },
  { id: "3", title: "Mobile App", mentions: 20, lastMentioned: "2023-06-13" },
  { id: "4", title: "Custom Dashboards", mentions: 8, lastMentioned: "2023-06-12" },
  { id: "5", title: "API Access", mentions: 10, lastMentioned: "2023-06-11" },
]

export default function ProductPage() {
  const [featureSort, setFeatureSort] = useState("mentions")

  const sortedFeatures = [...featureRequests].sort((a, b) => {
    if (featureSort === "mentions") {
      return b.mentions - a.mentions
    } else {
      return new Date(b.lastMentioned).getTime() - new Date(a.lastMentioned).getTime()
    }
  })

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Link href="/" className="inline-block mb-4">
        <Button variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </Link>
      <h1 className="text-3xl font-bold">Product Overview</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Interviews */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInterviews.map((interview) => (
                <Link key={interview.id} href="/interview" passHref>
                  <Card className="cursor-pointer hover:bg-muted transition-colors">
                    <CardContent className="flex items-center p-4">
                      <Avatar className="h-10 w-10 mr-4">
                        <AvatarImage src={interview.avatar} alt={interview.user} />
                        <AvatarFallback>{interview.user[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-grow">
                        <h3 className="font-semibold">{interview.user}</h3>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {interview.date}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Priority Feature Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Priority Feature Requests</CardTitle>
            <Select value={featureSort} onValueChange={setFeatureSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mentions">Most Mentioned</SelectItem>
                <SelectItem value="latest">Latest</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedFeatures.map((feature) => (
                <Link key={feature.id} href="/key-feature" passHref>
                  <Card className="cursor-pointer hover:bg-muted transition-colors">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <h3 className="font-semibold">{feature.title}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            <MessageCircle className="h-3 w-3 mr-1" />
                            {feature.mentions} mentions
                          </Badge>
                          <span className="text-xs text-muted-foreground">Last: {feature.lastMentioned}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

