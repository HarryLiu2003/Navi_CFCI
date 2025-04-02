"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  ChevronLeft, 
  Search, 
  PlusCircle, 
  LayoutGrid, 
  SlidersHorizontal,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Mock data for projects
const projects = [
  {
    id: 1,
    name: "Project Alpha",
    description: "Redesigning the user onboarding experience",
    status: "In Progress",
    members: [
      { name: "Alice Johnson" },
      { name: "Bob Smith" },
    ],
    lastUpdated: "2023-06-15",
  },
  {
    id: 2,
    name: "Project Beta",
    description: "Implementing new analytics dashboard",
    status: "Planning",
    members: [
      { name: "Charlie Davis" },
      { name: "Diana Miller" },
    ],
    lastUpdated: "2023-06-14",
  },
  {
    id: 3,
    name: "Project Gamma",
    description: "Mobile app development for iOS and Android",
    status: "Completed",
    members: [
      { name: "Eve Wilson" },
      { name: "Frank Thomas" },
    ],
    lastUpdated: "2023-06-13",
  },
  {
    id: 4,
    name: "Project Delta",
    description: "Customer feedback integration system",
    status: "In Progress",
    members: [
      { name: "Grace Lee" },
      { name: "Henry Clark" },
    ],
    lastUpdated: "2023-06-12",
  },
  {
    id: 5,
    name: "Project Epsilon",
    description: "AI-powered chatbot for customer support",
    status: "Planning",
    members: [
      { name: "Ivy Zhang" },
      { name: "Jack Brown" },
    ],
    lastUpdated: "2023-06-11",
  },
]

export default function ProjectListPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredProjects = projects.filter((project) => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Fixed header with improved design */}
      <div className="px-4 md:px-6 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <Button variant="outline" size="sm" className="h-8" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'grid' ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  <p>Grid View</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={4}>
                  <p>Filter Projects</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
            </Button>
            
            {/* User account dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">JD</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-xs">John Doe</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
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
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Page title and search section */}
      <div className="px-4 md:px-8 pt-5 pb-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-xl font-semibold">Projects</h1>
              <p className="text-sm text-muted-foreground">Manage and track all your research projects</p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> New Project
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden px-4 md:px-8 pb-6">
        <div className="max-w-7xl mx-auto h-full">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project List</CardTitle>
              <CardDescription>
                {filteredProjects.length} projects {searchTerm && `matching "${searchTerm}"`}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-5rem)] overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((project) => (
                      <Card key={project.id} className="flex flex-col h-full border shadow-sm hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{project.name}</CardTitle>
                            <Badge
                              variant={
                                project.status === "Completed"
                                  ? "default"
                                  : project.status === "In Progress"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="ml-2"
                            >
                              {project.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-grow py-2">
                          <p className="text-muted-foreground mb-4 text-sm">{project.description}</p>
                          <div className="mt-auto">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs text-muted-foreground">Updated: {project.lastUpdated}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-muted-foreground mr-2">Team:</span>
                              {project.members.map((member) => (
                                <Avatar key={member.name} className="w-6 h-6 border shadow-sm">
                                  <AvatarFallback className="text-xs">{member.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {filteredProjects.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No projects found matching your criteria.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

