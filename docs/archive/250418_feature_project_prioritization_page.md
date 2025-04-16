# Feature: Project Prioritization Page

**Date:** 2025-04-18
**Status:** Planning

## 1. Goal

To create a dedicated dashboard page for each project (`/project/[id]/prioritize`) that serves as a central hub for viewing, filtering, sorting, and analyzing all identified problem areas associated with that project. This page will facilitate project-level prioritization based on aggregated interview insights.

## 2. Scope

**In Scope:**

*   Displaying project details (name).
*   Fetching and displaying all problem areas linked to the project via its interviews.
*   Displaying key problem area details (title, description, priority, associated interview personas) in a central table view.
*   Advanced filtering controls for problem areas (date range, interview personas, priority, free text search).
*   Sorting controls for the problem area table (by date, priority, title).
*   A right-side slide-in panel (`Sheet`) displaying full details for a selected problem area, including:
    *   Full problem area information.
    *   Supporting excerpts.
    *   The full transcript of the *parent interview*.
    *   Ability to jump from an excerpt to its corresponding chunk in the transcript view within the panel.
    *   Link to navigate to the full interview analysis page.
*   A left-side slide-in panel (`Sheet`) displaying a list of all interviews associated with the project.
*   Appropriate loading and error states.
*   Consistent styling using existing Tailwind/Shadcn conventions.

**Out of Scope (for initial implementation):**

*   Editing problem area details directly on this page (editing happens on the interview analysis page).
*   Changing problem area priority/confirmation status on this page.
*   Batch actions on problem areas (e.g., batch assign priority).
*   Saving/sharing specific filter/sort configurations.
*   Advanced visualizations or analytics beyond the table view.

## 3. Key Features

*   **Project Context Header:** Displays project name and navigation (Back button, Show Interviews button).
*   **Prioritization Control Bar:** Collapsible or dedicated section with filters (Date, Persona, Priority, Search) and potentially sort controls.
*   **Problem Area Database:** Central table view using `shadcn/ui Table`.
    *   Columns: Title/Description, Priority, Personas (from Interview), Date Created.
    *   Clickable rows to open the detail panel.
*   **Problem Area Detail Panel (Right Sheet):**
    *   Width: ~800px.
    *   Tabs: "Problem Details" (Excerpts list) / "Interview Transcript".
    *   Excerpt-to-Transcript linking.
    *   "View Full Interview" button.
    *   Close button.
*   **Project Interviews Panel (Left Sheet):**
    *   Displays a list of interviews linked to the project using a `shadcn/ui Table`.
    *   Links to individual interview analysis pages.

## 4. Implementation Plan

### Phase 1: Backend API Endpoints

*   [x] **Define Data Structures:** Solidify the structure for `ProblemAreaWithInterviewContext` including necessary interview fields (id, title, personas).
*   [x] **API Endpoint:** `GET /api/projects/{projectId}/problem-areas`
    *   Implement logic in the `database-service` to fetch all `ProblemArea` records where **`is_confirmed` is true**, linked to interviews belonging to the specified `projectId`.
    *   Ensure the response includes the nested `interview: { id, title, personas }` context for each problem area.
    *   Handle authentication/authorization (user must have access to the project).
    *   Proxy this endpoint through the `api_gateway`.
*   [x] **API Endpoint:** `GET /api/projects/{projectId}/interviews`
    *   Implement logic in `database-service` to fetch all `Interview` records where `project_id` matches.
    *   Include necessary fields for the left panel display (id, title, participants, created_at).
    *   Proxy through `api_gateway`.
*   [x] **Verify Existing Endpoints:** Ensure `GET /api/projects/{projectId}` and `GET /api/interviews/{interviewId}` meet the needs of this page. Update if necessary.

### Phase 2: Frontend Page Structure & Data Fetching

*   [ ] **Create File:** `src/app/project/[id]/prioritize/page.tsx`.
*   [ ] **Basic Layout:** Implement the main `div` structure, header, main content area.
*   [ ] **Data Fetching:**
    *   Use `useParams` to get `projectId`.
    *   Implement `useEffect` hook to fetch project details, problem areas, and interviews on load using the new API functions (to be created in `lib/api.ts`).
    *   Handle loading and error states gracefully.
*   [ ] **State Management:** Set up `useState` for fetched data, loading/error, filters, sorting, and panel visibility/data.

### Phase 3: Prioritization Controls & Table View

*   [ ] **Filter Components:** Implement UI controls using Shadcn components:
    *   `Input` for text search.
    *   `Popover` + `Calendar` for date range.
    *   `DropdownMenu` with `DropdownMenuCheckboxItem` for Priority filter.
    *   `DropdownMenu` with `DropdownMenuCheckboxItem` for Persona filter (populate dynamically).
    *   "Clear Filters" button.
*   [ ] **Filter Logic:** Implement `useMemo` hook (`filteredAndSortedProblemAreas`) to apply filters based on state.
*   [ ] **Sorting Logic:**
    *   Add sorting state (`sortBy`, `sortDirection`).
    *   Implement `handleSort` function.
    *   Update `useMemo` hook to apply sorting after filtering.
*   [ ] **Table Implementation:**
    *   Use `shadcn/ui Table` components.
    *   Create table headers with sort buttons (`<Button variant="ghost">...<ArrowUpDown/></Button>`).
    *   Map `filteredAndSortedProblemAreas` to `TableRow` components.
    *   Format data in `TableCell` components (Badges for priority/personas, date formatting).
    *   Add `onClick` handler to rows to call `handleProblemAreaClick`.
*   [ ] **Empty/Loading States:** Implement states for the table when loading or no data matches filters.

### Phase 4: Side Panels (Sheets)

*   [ ] **Left Interviews Panel:**
    *   Implement `SheetTrigger` button in the header ("Show Project Interviews").
    *   Use `Sheet` component with `side="left"`.
    *   Create `renderInterviewsPanelContent` function.
    *   Implement the interview list using `shadcn/ui Table` components. Decide on appropriate columns (e.g., Title, Date, Participants).
    *   Fetch and display interviews from state (`projectInterviews`).
    *   Include links to `/interview-analysis/[id]` in table rows/cells.
*   [ ] **Right Detail Panel:**
    *   Implement `Sheet` triggered by `detailPanelData` state (set in `handleProblemAreaClick`).
    *   Use `Sheet` component with `side="right"` and appropriate width (`sm:w-[800px]`).
    *   Create `renderDetailPanelContent` function.
    *   Implement `Tabs` for "Details" and "Transcript".
    *   **Details Tab:** Render problem area info and excerpts list. Add `onClick` to excerpt buttons calling `scrollToChunk`.
    *   **Transcript Tab:**
        *   Fetch full `Interview` data when panel opens (`handleProblemAreaClick`). Handle loading state.
        *   Render transcript using existing logic/components, passing `chunkRefs`, `activeChunk`.
        *   Implement "Go Back" button calling `scrollToOriginatingElement`.
    *   Add "View Full Interview" button linking to `/interview-analysis/[interviewId]`.
    *   Ensure Close button works (`onOpenChange` on `Sheet`).

### Phase 5: Styling, Refinement & Testing

*   [ ] **Styling:** Apply Tailwind classes and ensure consistency with the rest of the application. Use `cn` utility where needed.
*   [ ] **Responsiveness:** Test and adjust layout/components for different screen sizes.
*   [ ] **State Management:** Refine state updates, especially around panel opening/closing and data refetching if necessary.
*   [ ] **Error Handling:** Improve user feedback for API errors or unexpected issues.
*   [ ] **Code Quality:** Refactor components, add comments where necessary.
*   [ ] **Manual Testing:** Thoroughly test filtering, sorting, panel interactions, transcript scrolling, links, and edge cases (empty data, errors).

## 5. Considerations / Open Questions

*   **Performance:** Fetching *all* **confirmed** problem areas for a large project might still be slow. Consider pagination for the table if performance becomes an issue.
*   **Real-time Updates:** How should the page handle updates if problem areas/interviews are modified elsewhere while the user is viewing this page? (Likely requires manual refresh for v1).
*   **Persona Filter Complexity:** How to best represent personas when a problem area might inherit multiple personas from its parent interview? (Current plan: Filter if *any* selected persona matches).
*   **Transcript Loading:** Fetching the full interview for the detail panel might be heavy. Optimize if needed.

---
_This document outlines the plan for the Project Prioritization Page. Progress should be tracked by marking steps as complete._ 