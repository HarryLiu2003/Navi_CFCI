# Project Issues Backlog

This file tracks known issues, bugs, and desired improvements that need to be addressed.

## Known Issues / Tasks

*   **[Resilience] Implement Circuit Breakers in Interview Analysis Service:**
    *   **Description:** Circuit breakers (`database_circuit`, `gemini_circuit`) are defined in `interview_analysis/app/main.py` but are not actively used around the calls to the Database Service API or the Google Gemini API within the core pipeline logic (`analysis_pipeline.py`, `persona/gemini_pipeline/pipeline.py`).
    *   **Impact:** Lack of implementation reduces resilience against temporary failures or rate limits from these external dependencies.
    *   **Action:** Implement checks (`can_execute`) before calls and recording (`record_failure`/`record_success`) after calls to these services within the relevant workflow/service/pipeline classes.
    *   **Priority:** Medium
