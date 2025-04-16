import * as React from "react"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

import { cn } from "@/lib/utils"

// Item type for a breadcrumb
export interface BreadcrumbItem {
  title: React.ReactNode // Allow JSX for potential truncation spans
  href: string
  isCurrentPage?: boolean
}

const Breadcrumb = ({
  items,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  items: BreadcrumbItem[]
}) => {
  // Determine if we're on the home page (no items)
  const isHomePage = items.length === 0;
  
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <ol className="flex items-center gap-1.5">
        {/* Only show home icon when not on the home page */}
        {!isHomePage && (
          <li>
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
        )}
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {/* Only show chevron if it's not the first item or if home icon is shown */}
            {(index > 0 || !isHomePage) && <ChevronRight className="h-3.5 w-3.5" />}
            {item.isCurrentPage ? (
              <span 
                aria-current="page"
                className="font-medium text-foreground block truncate max-w-[300px]" // Apply truncation here
                title={typeof item.title === 'string' ? item.title : undefined} // Add title attribute for hover
              >
                {item.title}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors block truncate max-w-[200px]" // Apply truncation here
                title={typeof item.title === 'string' ? item.title : undefined} // Add title attribute for hover
              >
                {item.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export { Breadcrumb } 