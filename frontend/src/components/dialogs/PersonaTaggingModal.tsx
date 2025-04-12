"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X as LucideX, Loader2, PlusCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
// UPDATED API Imports
import { updateInterview, createPersona, suggestPersonas, Persona } from '@/lib/api'; 
// Import color constants
import { 
  PERSONA_COLORS, 
  PERSONA_COLOR_OPTIONS, 
  getPersonaColorById, 
  getRandomPersonaColorId, 
  PersonaColorId 
} from '@/lib/constants';

// Define type for staged new personas
interface StagedPersona {
  name: string;
  colorId: PersonaColorId;
}

// UPDATED Props Interface
interface PersonaTaggingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  initialPersonas: Persona[]; // Now expects Persona objects
  allPersonas: Persona[]; // Now expects Persona objects
  onSaveSuccess: (updatedPersonas: Persona[]) => void; // Callback now receives Persona objects
}

export function PersonaTaggingModal({
  open,
  onOpenChange,
  interviewId,
  initialPersonas,
  allPersonas = [], 
  onSaveSuccess,
}: PersonaTaggingModalProps) {
  // Store selected persona IDs
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  // Store staged new personas (name and color)
  const [stagedPersonas, setStagedPersonas] = useState<Map<string, StagedPersona>>(new Map());
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for tracking which color selector is open
  const [openColorSelector, setOpenColorSelector] = useState<string | null>(null);
  // Add state to track if suggestions have been fetched for this modal instance
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);

  // State for AI suggestions
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // State for AI suggestions display
  const [aiSuggestedExisting, setAiSuggestedExisting] = useState<Persona[]>([]);
  const [aiSuggestedNew, setAiSuggestedNew] = useState<string[]>([]);

  // Map all personas by name for quick lookup
  const allPersonasMap = React.useMemo(() => 
      new Map(allPersonas.map(p => [p.name.toLowerCase(), p])), 
  [allPersonas]);

  // Map all personas by ID for quick lookup
  const allPersonasIdMap = React.useMemo(() =>
      new Map(allPersonas.map(p => [p.id, p])),
  [allPersonas]);

  // Add a ref for the color selector container
  const colorSelectorRef = React.useRef<HTMLDivElement>(null);

  // Handle clicking outside of color selector
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorSelectorRef.current && !colorSelectorRef.current.contains(event.target as Node)) {
        setOpenColorSelector(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize state when modal opens or initialPersonas change
  useEffect(() => {
    if (open) {
      setSelectedPersonaIds(new Set(initialPersonas?.map(p => p.id) || []));
      setStagedPersonas(new Map()); // Clear pending new personas
      setInputValue('');
      setError(null);
      setOpenColorSelector(null); // Ensure color selector is closed
      setIsSuggesting(false); // Reset suggestion state
      setSuggestionError(null); // Reset suggestion error
      setSuggestionsFetched(false); // Reset suggestion fetch flag
      // Clear suggestions when modal opens
      setAiSuggestedExisting([]);
      setAiSuggestedNew([]);
    } else {
      // Clear suggestions when modal closes as well
      setAiSuggestedExisting([]);
      setAiSuggestedNew([]);
    }
  }, [open, initialPersonas]);

  // Get full Persona objects for selected IDs
  const selectedPersonaObjects = React.useMemo(() => 
      Array.from(selectedPersonaIds)
          .map(id => allPersonasIdMap.get(id))
          .filter((p): p is Persona => p !== undefined), 
  [selectedPersonaIds, allPersonasIdMap]);

  // Toggle selection of an *existing* persona ID
  const toggleSelection = useCallback((personaId: string) => {
    setSelectedPersonaIds(prev => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
    // If a new name was pending with the same name as the selected, remove it
    const persona = allPersonasIdMap.get(personaId);
    if (persona) {
        setStagedPersonas(prev => {
            const next = new Map(prev);
            next.delete(persona.name.toLowerCase()); // Use lowercase name as key
            return next;
        });
    }
  }, [allPersonasIdMap]);

  // Modify stageNewPersona to automatically open color selector for new personas
  const stageNewPersona = useCallback((newPersonaName: string) => {
    const trimmedName = newPersonaName.trim();
    const lowerCaseName = trimmedName.toLowerCase();

    if (
        trimmedName && 
        !allPersonasMap.has(lowerCaseName) &&
        !stagedPersonas.has(lowerCaseName)
    ) {
        const randomColorId = getRandomPersonaColorId();
        setStagedPersonas(prev => 
            new Map(prev).set(lowerCaseName, { name: trimmedName, colorId: randomColorId })
        );
        setOpenColorSelector(lowerCaseName); // Open color selector for new persona
        setInputValue('');
    } else {
        setInputValue('');
    }
  }, [allPersonasMap, stagedPersonas]);

  // Remove a staged new persona
  const unstageNewPersona = useCallback((lowerCaseName: string) => {
    setStagedPersonas(prev => {
        const next = new Map(prev);
        next.delete(lowerCaseName);
        return next;
    });
    if (openColorSelector === lowerCaseName) {
      setOpenColorSelector(null); // Close color selector if it belonged to this persona
    }
  }, [openColorSelector]);

  // Update the color of a staged new persona
  const updateStagedPersonaColor = useCallback((lowerCaseName: string, newColorId: PersonaColorId) => {
    setStagedPersonas(prev => {
        const next = new Map(prev);
        const staged = next.get(lowerCaseName);
        if (staged) {
            next.set(lowerCaseName, { ...staged, colorId: newColorId });
        }
        return next;
    });
  }, []);
  
  // Handle input keydown for staging new persona on Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue) {
        e.preventDefault(); 
        stageNewPersona(inputValue);
      }
  }, [inputValue, stageNewPersona]);

  // Filter available personas (exclude already selected IDs)
  const availablePersonaObjects = allPersonas.filter(p => !selectedPersonaIds.has(p.id));

  // --- AI Suggestion Effect --- 
  useEffect(() => {
    // Only run if the modal is open, we have an interviewId, 
    // no personas were passed initially, AND no suggestions have been fetched yet.
    if (open && interviewId && initialPersonas?.length === 0 && !suggestionsFetched && !isSuggesting) {
      let isCancelled = false;
      const fetchSuggestions = async () => {
        setIsSuggesting(true);
        setSuggestionError(null);
        setAiSuggestedExisting([]); // Clear previous suggestions
        setAiSuggestedNew([]);      // Clear previous suggestions
        console.log(`[Modal] Triggering AI persona suggestion for interview: ${interviewId}`);
        toast.info("Checking for AI persona suggestions...");

        try {
          const suggestions = await suggestPersonas(interviewId);
          if (isCancelled) return;

          console.log("[Modal] Received suggestions:", suggestions);

          // Process existing suggestions
          const suggestedExistingPersonas = suggestions.existing_persona_ids
            .map(id => allPersonasIdMap.get(id)) // Map IDs to Persona objects
            .filter((p): p is Persona => p !== undefined) // Filter out undefined (if ID mismatch)
            .filter(p => !selectedPersonaIds.has(p.id) && !stagedPersonas.has(p.name.toLowerCase())); // Filter out already selected/staged
          
          setAiSuggestedExisting(suggestedExistingPersonas);

          // Process new suggestions
          const currentStagedLower = new Set(Array.from(stagedPersonas.keys()));
          const suggestedNewNames = suggestions.suggested_new_personas
             .filter(name => !allPersonasMap.has(name.toLowerCase()) && // Ensure it doesn't already exist
                             !currentStagedLower.has(name.toLowerCase())); // Ensure it's not already staged
             
          setAiSuggestedNew(suggestedNewNames);
          
          // Update Toast message based on processed suggestions
          const suggestionCount = suggestedExistingPersonas.length + suggestedNewNames.length;
          if (suggestionCount > 0) {
             toast.success(`${suggestionCount} AI suggestion(s) ready for review.`);
          } else {
             toast.info("No new suggestions found by AI.");
          }
          
          // Old logging/auto-select logic removed - user must approve

        } catch (err: any) {
          if (isCancelled) return;
          console.error("[Modal] Failed to fetch persona suggestions:", err);
          const errorMsg = err.message || "Failed to load AI suggestions.";
          setSuggestionError(errorMsg);
          toast.error(`Suggestion Error: ${errorMsg}`);
        } finally {
          if (!isCancelled) {
            setIsSuggesting(false);
            setSuggestionsFetched(true); // Mark suggestions as fetched (or attempted)
          }
        }
      };
      
      fetchSuggestions();

      // Cleanup function to prevent state updates if component unmounts or deps change while fetching
      return () => {
        isCancelled = true;
      };
    }
  }, [open, interviewId, initialPersonas, suggestionsFetched, allPersonasIdMap, allPersonasMap]);

  // --- Action Handlers for Suggestions ---
  const handleSelectExistingSuggestion = useCallback((persona: Persona) => {
    toggleSelection(persona.id);
    setAiSuggestedExisting(prev => prev.filter(p => p.id !== persona.id));
  }, [toggleSelection]);

  const handleCreateNewSuggestion = useCallback((name: string) => {
    stageNewPersona(name);
    setAiSuggestedNew(prev => prev.filter(n => n !== name));
  }, [stageNewPersona]);

  // Handle saving the selected/new personas
  const handleSave = async () => {
    if (!interviewId) {
      setError("Interview ID is missing. Cannot save.");
      return;
    }
    setIsLoading(true);
    setError(null);
    let finalPersonaIds = Array.from(selectedPersonaIds);
    const createdPersonas: Persona[] = []; // Store successfully created personas

    try {
      // 1. Create any new personas from the staged map
      if (stagedPersonas.size > 0) {
        const creationPromises = Array.from(stagedPersonas.values()).map(staged => 
            createPersona(staged.name, staged.colorId) // Pass name and colorId
        );
        const creationResults = await Promise.allSettled(creationPromises);
        
        creationResults.forEach((result, index) => {
          const staged = Array.from(stagedPersonas.values())[index];
          if (result.status === 'fulfilled' && result.value.status === 'success' && result.value.data) {
            finalPersonaIds.push(result.value.data.id);
            createdPersonas.push(result.value.data); // Add to list for callback
            toast.success(`Persona "${staged.name}" created.`);
          } else {
            const errorMessage = result.status === 'rejected' 
                ? (result.reason as Error).message 
                : result.value.message || `Failed to create persona "${staged.name}"`;
            toast.error(errorMessage);
            console.error(`Failed to create persona "${staged.name}":`, result);
            // Optionally, re-throw or set error state to stop the process
          }
        });
      }

      // 2. Update the interview with the final list of IDs
      console.log(`[PersonaTaggingModal] Updating interview ${interviewId} with persona IDs:`, finalPersonaIds);
      const updateResult = await updateInterview(interviewId, { personaIds: finalPersonaIds });

      if (updateResult.status === 'success' && updateResult.data) {
        toast.success('Personas linked successfully!');
        
        // Construct the final list of Persona objects for the callback
        const finalPersonaObjects = Array.from(new Set(finalPersonaIds)) // Ensure unique IDs
            .map(id => allPersonasIdMap.get(id) || createdPersonas.find(p => p.id === id))
            .filter((p): p is Persona => p !== undefined);
            
        onSaveSuccess(finalPersonaObjects); // Notify parent component
        onOpenChange(false); // Close the modal
      } else {
        throw new Error(updateResult.message || 'Failed to link personas to interview');
      }
    } catch (err: any) {
      console.error('[PersonaTaggingModal] Error saving personas:', err);
      const errorMessage = err.message || 'An unknown error occurred';
      setError(errorMessage);
      toast.error(`Failed to save: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if changes have been made
  const hasChanges = useMemo(() => {
    const initialIds = new Set(initialPersonas?.map(p => p.id) || []);
    return stagedPersonas.size > 0 || 
           selectedPersonaIds.size !== initialIds.size || 
           !Array.from(selectedPersonaIds).every(id => initialIds.has(id));
  }, [initialPersonas, selectedPersonaIds, stagedPersonas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tag Interview Personas</DialogTitle>
          <DialogDescription>
            Select existing personas or type a new name and press Enter to create.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 flex flex-col gap-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search or create personas..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isSuggesting}
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm ring-offset-background 
                       placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 
                       focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {inputValue && !allPersonasMap.has(inputValue.toLowerCase()) && !stagedPersonas.has(inputValue.toLowerCase()) && (
              <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-background rounded-md border shadow-md">
                <button
                  onClick={() => stageNewPersona(inputValue)}
                  disabled={isLoading || isSuggesting}
                  className="w-full flex items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground
                           transition-colors duration-150 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Create "{inputValue.trim()}"
                </button>
              </div>
            )}
          </div>

          {/* --- AI Suggestions Section (NEW) --- */} 
          {!isSuggesting && !suggestionError && (aiSuggestedExisting.length > 0 || aiSuggestedNew.length > 0) && (
            <div className="p-3 rounded-md border border-dashed border-primary/50 bg-primary/5">
               <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-primary">
                 <Sparkles className="w-4 h-4"/> AI Suggestions
               </h4>
               <div className="flex flex-wrap gap-2">
                 {/* Suggested Existing Personas */} 
                 {aiSuggestedExisting.map(persona => {
                   const colorInfo = getPersonaColorById(persona.color);
                   return (
                     <div key={`suggest-exist-${persona.id}`} className="flex items-center gap-1">
                        <Badge 
                          className={cn(
                            "text-sm py-1 pl-2 pr-1 h-7 font-normal rounded-md border inline-flex items-center gap-1",
                            colorInfo.bg, 
                            colorInfo.text, 
                            colorInfo.border,
                            `hover:${colorInfo.bg}`, 
                            `hover:${colorInfo.text}`
                          )}
                        >
                          <Sparkles className="w-3 h-3 mr-1 opacity-80" aria-label="Suggested"/>
                          {persona.name}
                        </Badge>
                        <Button 
                           variant="outline"
                           size="icon"
                           className="h-7 w-7 flex-shrink-0 rounded-full border-dashed border-primary/50 hover:bg-primary/10"
                           onClick={() => handleSelectExistingSuggestion(persona)}
                           aria-label={`Select suggested persona ${persona.name}`}
                        >
                           <PlusCircle className="h-4 w-4 text-primary"/>
                         </Button>
                       </div>
                    );
                  })}
                  
                  {/* Suggested New Personas */} 
                  {aiSuggestedNew.map(name => (
                     <div key={`suggest-new-${name}`} className="flex items-center gap-1">
                       <Badge 
                          variant="outline"
                          className="text-sm py-1 pl-2 pr-2 h-7 font-normal rounded-md border border-dashed inline-flex items-center gap-1 text-muted-foreground"
                       >
                         <Sparkles className="w-3 h-3 mr-1 opacity-80" aria-label="Suggested"/>
                         {name} 
                         <span className="text-xs opacity-70 ml-0.5">(New)</span>
                       </Badge>
                       <Button 
                           variant="outline"
                           size="icon"
                           className="h-7 w-7 flex-shrink-0 rounded-full border-dashed border-primary/50 hover:bg-primary/10"
                           onClick={() => handleCreateNewSuggestion(name)}
                           aria-label={`Create suggested new persona ${name}`}
                       >
                         <PlusCircle className="h-4 w-4 text-primary"/>
                       </Button>
                     </div>
                  ))}
               </div>
            </div>
          )}
          {/* --- End AI Suggestions Section --- */} 

          {/* Suggestion Loading/Error Indicator */} 
          {isSuggesting && (
            <div className="flex items-center justify-center p-4 border rounded-md bg-muted/30 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching AI persona suggestions...
            </div>
          )}
          {suggestionError && !isSuggesting && (
             <div className="flex items-center gap-2 p-3 border rounded-md border-destructive/50 bg-destructive/10 text-sm text-destructive">
               <AlertTriangle className="h-4 w-4 flex-shrink-0"/>
               <span>{suggestionError}</span>
             </div>
          )}

          {/* Selected and Staged Personas */}
          {(selectedPersonaObjects.length > 0 || stagedPersonas.size > 0) && (
            <div className="p-3 rounded-md border bg-muted/30">
              <h4 className="text-sm font-medium mb-2">Selected Personas</h4>
              <div className="flex flex-wrap gap-2">
                {/* Selected existing personas */}
                {selectedPersonaObjects.map(persona => {
                  const colorInfo = getPersonaColorById(persona.color);
                  return (
                    <Badge 
                      key={persona.id} 
                      className={cn(
                        "text-sm py-1 px-3 h-7 font-normal rounded-md border inline-flex items-center gap-1.5",
                        colorInfo.bg, 
                        colorInfo.text, 
                        colorInfo.border,
                        `hover:${colorInfo.bg}`, 
                        `hover:${colorInfo.text}`
                      )}
                    >
                      {persona.name}
                      <button
                        onClick={() => toggleSelection(persona.id)}
                        disabled={isLoading || isSuggesting}
                        className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring 
                                 focus:ring-offset-2 disabled:opacity-50 hover:bg-background/10 p-0.5"
                      >
                        <LucideX className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                
                {/* Staged new personas */}
                {Array.from(stagedPersonas.entries()).map(([lowerCaseName, staged]) => {
                  const colorInfo = getPersonaColorById(staged.colorId);
                  return (
                    <div key={lowerCaseName} className="relative group">
                      <Badge 
                        className={cn(
                          "text-sm py-1 px-3 h-7 font-normal rounded-md border inline-flex items-center gap-1.5",
                          colorInfo.bg, 
                          colorInfo.text, 
                          colorInfo.border,
                          `hover:${colorInfo.bg}`, 
                          `hover:${colorInfo.text}`
                        )}
                      >
                        <PlusCircle className="h-3 w-3"/> 
                        {staged.name}
                        <span className="text-xs opacity-70">(New)</span>
                        <button
                          onClick={() => unstageNewPersona(lowerCaseName)}
                          disabled={isLoading || isSuggesting}
                          className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring 
                                   focus:ring-offset-2 disabled:opacity-50 hover:bg-background/10 p-0.5"
                        >
                          <LucideX className="h-3 w-3" />
                        </button>
                      </Badge>
                      
                      {/* Color Selector - Only shown when first created */}
                      {openColorSelector === lowerCaseName && (
                        <div 
                          ref={colorSelectorRef}
                          className="absolute top-full left-0 mt-2 z-20 p-2 rounded-md border bg-background shadow-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-xs text-muted-foreground mb-2">Choose Color</div>
                          <div className="flex flex-wrap gap-1.5">
                            {PERSONA_COLOR_OPTIONS.map(option => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  updateStagedPersonaColor(lowerCaseName, option.id);
                                  setOpenColorSelector(null);
                                }}
                                className={cn(
                                  "w-5 h-5 rounded-md border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                                  option.bg,
                                  option.border,
                                  staged.colorId === option.id ? 'ring-2 ring-offset-1 ring-foreground' : ''
                                )}
                                aria-label={`Set color to ${option.name}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Personas */}
          <div className="border rounded-md">
            <div className="p-3 border-b">
              <h4 className="text-sm font-medium">Available Personas</h4>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {availablePersonaObjects.length === 0 && !inputValue && stagedPersonas.size === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    Type to search or create new personas.
                  </p>
                ) : availablePersonaObjects.length === 0 && (inputValue || stagedPersonas.size > 0) ? (
                   <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    No matching personas found.
                  </p>
                ) : (
                  availablePersonaObjects.map((persona) => {
                    const colorInfo = getPersonaColorById(persona.color);
                    return (
                      <button
                        key={persona.id}
                        onClick={() => {
                          toggleSelection(persona.id);
                          setInputValue('');
                        }}
                        disabled={isLoading || isSuggesting}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                          "transition-colors duration-150",
                          colorInfo.bg,
                          colorInfo.text,
                          colorInfo.border,
                          "hover:opacity-90 focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:outline-none"
                        )}
                      >
                        {persona.name}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {error && !isLoading && (
          <p className="text-sm text-destructive mt-4 px-1">Error: {error}</p>
        )}

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isSuggesting}>
            Cancel 
          </Button>
          <Button 
            type="button" 
            onClick={handleSave} 
            disabled={isLoading || isSuggesting || !hasChanges}
            className="min-w-[100px]"
          >
            {(isLoading || isSuggesting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Saving..." : isSuggesting ? "Suggesting..." : "Save Personas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 