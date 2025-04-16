# Refactoring Plan: Problem Areas & Excerpts as First-Class Entities

**Date:** 2025-04-15
**Status:** Proposed

## 1. Goal

Refactor the system to store and manage Problem Areas and Excerpts as separate database records linked to Interviews via foreign keys. This replaces the current approach of storing this data within the `analysis_data` JSON blob on the `Interview` model.

## 2. Motivation

*   Enable granular updates and state management for individual Problem Areas (e.g., `is_confirmed` status).
*   Improve database queryability for insights across interviews (e.g., find all confirmed problems, search excerpts).
*   Increase efficiency by avoiding reads/writes of the large `analysis_data` JSON blob for minor updates.
*   Enhance data integrity and scalability by using proper relational modeling.
*   Support future features related to specific Problem Areas or Excerpts more easily.

## 3. Overview of Changes

This refactor impacts multiple layers:

*   **Database:** Schema modification (`schema.prisma`).
*   **Database Service:** Significant updates to handle new models, repository logic, and API endpoints.
*   **Interview Analysis Service:** Minor update to how analysis results are prepared for storage.
*   **API Gateway:** Add routes to expose new Database Service endpoints.
*   **Data Migration:** Script to move existing JSON data to new tables.
*   **Frontend:** Update data fetching, display logic, and API calls for editing/confirming.

## 4. Detailed Plan

**Phase 1: Backend Schema & API Refactoring**

*   **[X] Task 1.1: Modify Database Schema (`services/database-service/prisma/schema.prisma`)**
    *   **[X] 1.1.1:** Define `ProblemArea` model:
        *   Fields: `id` (UUID, `@id @default(uuid())`), `interview_id` (String), `interview` (@relation), `analysis_problem_id` (String, original ID like "1"), `title` (String), `description` (String, `@db.Text`), `is_confirmed` (Boolean, `@default(false)`), `created_at` (DateTime, `@default(now())`), `updated_at` (DateTime, `@updatedAt`), `excerpts` (Relation `Excerpt[]`).
        *   Add `@@index([interview_id])`.
        *   Add `@@map("problem_areas")`.
    *   **[X] 1.1.2:** Define `Excerpt` model:
        *   Fields: `id` (UUID, `@id @default(uuid())`), `problem_area_id` (String), `problemArea` (@relation), `quote` (String, `@db.Text`), `categories` (String[], PostgreSQL array), `insight` (String, `@db.Text`), `chunk_number` (Int).
        *   Add `@@index([problem_area_id])`.
        *   Add `@@map("excerpts")`.
    *   **[X] 1.1.3:** Update `Interview` model:
        *   Add relation: `problemAreas ProblemArea[]`.
        *   Keep existing `analysis_data Json` (temporarily for migration backup).
        *   Keep existing `problem_count Int`.
    *   **[X] 1.1.4:** Generate and Apply Migration:
        *   Run `npm run prisma:migrate:dev -- --name add_problem_area_excerpt_tables` from project root.
        *   Verify schema sync to `frontend/prisma/schema.prisma`.
        *   Verify Prisma Client generation in both `database-service` and `frontend`.

*   **[X] Task 1.2: Update Database Service (`services/database-service`)**
    *   **[X] 1.2.1:** Update Repository Layer (`src/repositories/`)
    *   **[X] 1.2.2:** Update API Layer (`src/api/`) 
        *   Modify `POST /interviews`: Update validation, call modified `createInterview` repo method.
        *   Verify `GET /interviews/:id`: Ensure response includes nested relations.
        *   Implement `PUT /problem_areas/:id`: Add route, validation, call `updateProblemArea` repo method.
        *   Implement `PATCH /problem_areas/:id/confirm`: Add route, validation, call `confirmProblemArea` repo method.
        *   Implement `DELETE /problem_areas/:id`: Add route, call `deleteProblemArea` repo method.
    *   **[X] 1.2.3:** Update Types/DTOs *(Covered/NA)*

*   **[X] Task 1.3: Update Interview Analysis Service (`services/interview_analysis`)**
    *   **[X] 1.3.1:** Modify `store_interview` (`app/services/storage/repository.py`):
        *   Transform `analysis_result["problem_areas"]` into the nested `problemAreasData` structure expected by the updated Database Service `POST /interviews` API.
        *   Include `problemAreasData` in the `json_data` payload sent via `call_authenticated_service`.
        *   Continue sending the full `analysis_result` to the `analysis_data` field for now.

*   **[X] Task 1.4: Update API Gateway (`services/api_gateway`)**
    *   **[X] 1.4.1:** Add new FastAPI routes (`app/main.py`):
        *   Forward `PUT /problem_areas/{problem_area_id}` to Database Service `PUT /problem_areas/:id`.
        *   Forward `PATCH /problem_areas/{problem_area_id}/confirm` to Database Service `PATCH /problem_areas/:id/confirm`.
        *   Forward `DELETE /problem_areas/{problem_area_id}` to Database Service `DELETE /problem_areas/:id`.
    *   **[X] 1.4.2:** Ensure routes use authentication (`verify_token`) and pass necessary parameters (`userId`, body, path params) via `call_authenticated_service`.

**Phase 2: Data Migration**

*   **[X] Task 2.1: Create Migration Script**
    *   **[X] 2.1.1:** Create `services/database-service/scripts/migrate_json_to_tables.ts`.
    *   **[X] 2.1.2:** Implement script logic:
        *   Initialize Prisma Client.
        *   Fetch `Interview` records (`id`, `analysis_data`).
        *   Loop through interviews.
        *   Parse `analysis_data`.
        *   Check if `ProblemArea` records already exist for the `interview_id` (idempotency). If yes, skip.
        *   Use `prisma.$transaction`.
        *   Inside transaction, loop through JSON `problem_areas`:
            *   Create `ProblemArea`.
            *   Loop through JSON `excerpts`:
                *   Create `Excerpt` linked to the new `ProblemArea`.
        *   Add logging for progress and errors.
*   **[X] Task 2.2: Execute Migration Script**
    *   **[X] 2.2.1:** Run the script in a controlled environment *after* backend deployment and *before* frontend deployment. (Executed in Dev Env)

**Phase 3: Frontend Refactoring**

*   **[X] Task 3.1: Update API Library (`frontend/src/lib/api.ts`)**
    *   **[X] 3.1.1:** Define `ProblemArea`, `Excerpt` interfaces. Update `Interview` interface to include `problemAreas?: ProblemArea[]`.
    *   **[X] 3.1.2:** Update `getInterviewById` return type annotation.
    *   **[X] 3.1.3:** Implement `updateProblemArea(id, data)` function (calls `PUT /api/problem-areas/:id`).
    *   **[X] 3.1.4:** Implement `confirmProblemArea(id, isConfirmed)` function (calls `PATCH /api/problem-areas/:id/confirm`).
    *   **[X] 3.1.5:** Implement `deleteProblemArea(id)` function (calls `DELETE /api/problem-areas/:id`).

*   **[X] Task 3.2: Update Interview Analysis Page (`frontend/src/app/interview-analysis/[id]/page.tsx`)**
    *   **[X] 3.2.1:** Update `interview` state type to `Interview | null`.
    *   **[X] 3.2.2:** Change data access logic to use `interview?.problemAreas` instead of parsing `analysis_data`.
    *   **[X] 3.2.3:** Update rendering logic (`renderProblemAreas`):
        *   Iterate `interview?.problemAreas ?? []`.
        *   Use `problemArea.id` (UUID) for keys and actions.
        *   Iterate `problemArea.excerpts ?? []`.
    *   **[X] 3.2.4:** Implement "Confirm" button:
        *   Add button/icon to problem area card.
        *   Style based on `

*   **[X] Task 3.3: Update Edit Modal (`frontend/src/components/dialogs/EditProblemAreaModal.tsx`)**
    *   **[X] 3.3.1:** Create the component file.
    *   **[X] 3.3.2:** Implement the modal UI.
    *   **[X] 3.3.3:** Ensure it accepts props correctly.
    *   **[X] 3.3.4:** Implement the save handler.
    *   **[X] 3.3.5:** Call `onSaveSuccess` prop.
    *   **[X] 3.3.6:** Uncomment import and usage.

**Phase 4: Testing & Cleanup**

*   **[ ] Task 4.1: Backend Testing**
    *   **[ ] 4.1.1:** Implement unit tests for new repository methods.
    *   **[ ] 4.1.2:** Implement integration tests for new API endpoints.
*   **[ ] Task 4.2: Frontend Testing**
    *   **[ ] 4.2.1:** Write/update component tests.
    *   **[ ] 4.2.2:** Write/update E2E tests.
*   **[ ] Task 4.3: Manual End-to-End Testing**
    *   **[ ] 4.3.1:** Test analysis upload and verify data in new tables.
    *   **[ ] 4.3.2:** Test fetching and displaying interviews with problem areas/excerpts.
    *   **[ ] 4.3.3:** Test confirming/unconfirming problem areas.
    *   **[ ] 4.3.4:** Test editing problem area titles/descriptions.
    *   **[ ] 4.3.5 (Optional):** Test deleting problem areas.
*   **[ ] Task 4.4: Future Cleanup (Post-Verification)**
    *   **[ ] 4.4.1:** Plan task to remove `analysis_data` field from `Interview` model.
    *   **[ ] 4.4.2:** Plan task to remove logic populating/reading `analysis_data`.
    *   **[ ] 4.4.3:** Plan task to run the cleanup migration.

## 5. Considerations

*   **Authorization:** Ensure robust authorization checks are implemented and tested.
*   **Transactions:** Verify transaction usage for atomic operations.
*   **Error Handling:** Test error cases and handling.
*   **Deployment:** Coordinate backend, migration script execution, and frontend deployments.
*   **Rollback:** Keep `analysis_data` temporarily for potential rollback needs.