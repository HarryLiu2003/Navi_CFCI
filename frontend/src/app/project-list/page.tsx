"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronLeft, Search, PlusCircle } from "lucide-react"

// Mock data for projects
const projects = [
  {
    id: 1,
    name: "Project Alpha",
    description: "Redesigning the user onboarding experience",
    status: "In Progress",
    members: [
      { name: "Alice", avatar: "/placeholder.svg?height=32&width=32" },
      { name: "Bob", avatar: "/placeholder.svg?height=32&width=32" },
    ],
    lastUpdated: "2023-06-15",
  },
  {
    id: 2,
    name: "Project Beta",
    description: "Implementing new analytics dashboard",
    status: "Planning",
    members: [
      { name: "Charlie", avatar: "/placeholder.svg?height=32&width=32" },
      { name: "Diana", avatar: "/placeholder.svg?height=32&width=32" },
    ],
    lastUpdated: "2023-06-14",
  },
  {
    id: 3,
    name: "Project Gamma",
    description: "Mobile app development for iOS and Android",
    status: "Completed",
    members: [
      { name: "Eve", avatar: "/placeholder.svg?height=32&width=32" },
      { name: "Frank", avatar: "/placeholder.svg?height=32&width=32" },
    ],
    lastUpdated: "2023-06-13",
  },
  {
    id: 4,
    name: "Project Delta",
    description: "Customer feedback integration system",
    status: "In Progress",
    members: [
      { name: "Grace", avatar: "/placeholder.svg?height=32&width=32" },
      { name: "Henry", avatar: "/placeholder.svg?height=32&width=32" },
    ],
    lastUpdated: "2023-06-12",
  },
  {
    id: 5,
    name: "Project Epsilon",
    description: "AI-powered chatbot for customer support",
    status: "Planning",
    members: [
      { name: "Ivy", avatar: "/placeholder.svg?height=32&width=32" },
      { name: "Jack", avatar: "/placeholder.svg?height=32&width=32" },
    ],
    lastUpdated: "2023-06-11",
  },
]

export default function ProjectListPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredProjects = projects.filter((project) => project.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/" className="inline-block">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Project List</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <Link href="/product" key={project.id} className="block">
            <Card className="flex flex-col cursor-pointer hover:bg-muted transition-colors">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-muted-foreground mb-4">{project.description}</p>
                <div className="flex justify-between items-center mb-4">
                  <Badge
                    variant={
                      project.status === "Completed"
                        ? "default"
                        : project.status === "In Progress"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {project.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Updated: {project.lastUpdated}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground mr-2">Team:</span>
                  {project.members.map((member, index) => (
                    <Avatar key={index} className="w-8 h-8">
                      <AvatarImage src={member.avatar} alt={member.name} />
                      <AvatarFallback>{member.name[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

