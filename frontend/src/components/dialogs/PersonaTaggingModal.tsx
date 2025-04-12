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
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger, 
} from "@/components/ui/alert-dialog";
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
import { X as LucideX, Loader2, PlusCircle, AlertTriangle, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
// UPDATED API Imports
import { updateInterview, createPersona, suggestPersonas, Persona, deletePersona } from '@/lib/api'; 
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
  onDeleteSuccess: (deletedPersonaId: string) => void; // New callback for deletion
  isInitialTagging?: boolean; // NEW: Optional prop to indicate initial tagging context
}

export function PersonaTaggingModal({
  open,
  onOpenChange,
  interviewId,
  initialPersonas,
  allPersonas = [], 
  onSaveSuccess,
  onDeleteSuccess,
  isInitialTagging = false, // Default to false
}: PersonaTaggingModalProps) {
  // Store selected persona IDs
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(new Set());
  // Store staged new personas (name and color)
  const [stagedPersonas, setStagedPersonas] = useState<Map<string, StagedPersona>>(new Map());
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add state to track if suggestions have been fetched for this modal instance
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);

  // State for AI suggestions
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // State for AI suggestions display
  const [aiSuggestedExisting, setAiSuggestedExisting] = useState<Persona[]>([]);
  const [aiSuggestedNew, setAiSuggestedNew] = useState<string[]>([]);

  // State for delete confirmation
  const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // NEW: Track persona IDs that are in the process of being deleted
  const [deletingPersonaIds, setDeletingPersonaIds] = useState<Set<string>>(new Set());

  // Map all personas by name for quick lookup
  const allPersonasMap = React.useMemo(() => 
      new Map(allPersonas.map(p => [p.name.toLowerCase(), p])), 
  [allPersonas]);

  // Map all personas by ID for quick lookup
  const allPersonasIdMap = React.useMemo(() =>
      new Map(allPersonas.map(p => [p.id, p])),
  [allPersonas]);

  // Initialize state when modal opens or initialPersonas change
  useEffect(() => {
    if (open) {
      setSelectedPersonaIds(new Set(initialPersonas?.map(p => p.id) || []));
      setStagedPersonas(new Map()); // Clear pending new personas
      setInputValue('');
      setError(null);
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
    setIsLoading(true);
    setError(null);

    try {
      // First, create any new personas that were staged
      const createdPersonas: Persona[] = [];
      const stagedEntries = Array.from(stagedPersonas.entries());
      for (const [name, staged] of stagedEntries) {
        const colorId = staged.colorId;
        const result = await createPersona(name, colorId);
        if (result.status === 'success' && result.data) {
          createdPersonas.push(result.data);
        } else {
          throw new Error(result.message || `Failed to create persona "${name}"`);
        }
      }

      // Get the IDs of all valid personas (existing + newly created)
      const validPersonaIds = new Set([
        ...Array.from(selectedPersonaIds).filter(id => 
          // Only include IDs that exist in allPersonas
          allPersonas.some(p => p.id === id)
        ),
        ...createdPersonas.map(p => p.id)
      ]);

      // Update the interview with valid persona IDs
      const updateResult = await updateInterview(interviewId, {
        personaIds: Array.from(validPersonaIds)
      });

      if (updateResult.status === 'success') {
        toast.success('Personas linked successfully!');
        
        // Construct the final list of Persona objects for the callback
        const finalPersonaObjects = Array.from(validPersonaIds)
            .map(id => allPersonas.find(p => p.id === id) || createdPersonas.find(p => p.id === id))
            .filter((p): p is Persona => p !== undefined);
            
        onSaveSuccess(finalPersonaObjects);
        onOpenChange(false);
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

  // Handler function to actually perform the deletion
  const performDelete = useCallback(async () => {
    if (!personaToDelete) return;

    const personaId = personaToDelete.id;
    const personaName = personaToDelete.name;
    
    try {
      console.log(`[PersonaTaggingModal] Deleting persona: ID=${personaId}, Name=${personaName}`);
      
      // Add this persona ID to the set of deleting personas
      setDeletingPersonaIds(prev => new Set(Array.from(prev).concat(personaId)));
      
      // Immediately close the dialog
      setPersonaToDelete(null);
      
      // Make the API call to delete the persona
      const result = await deletePersona(personaId);

      if (result.status === 'success') {
        toast.success(`Persona "${personaName}" deleted.`);
        
        // Only after successful deletion, update the UI
        // Important: Keep the persona ID in deletingPersonaIds until parent component processes the deletion
        setTimeout(() => {
          // Notify parent to update list
          onDeleteSuccess(personaId);
          
          // Remove from selected personas
          setSelectedPersonaIds(prev => {
            const next = new Set(Array.from(prev).filter(id => id !== personaId));
            return next;
          });
          
          // Remove from AI suggested personas
          setAiSuggestedExisting(prev => prev.filter(p => p.id !== personaId));
          
          // Wait a bit more to ensure UI has processed all updates before removing from deletingPersonaIds
          setTimeout(() => {
            setDeletingPersonaIds(prev => {
              const next = new Set(Array.from(prev));
              next.delete(personaId);
              return next;
            });
          }, 300); // Additional small delay to prevent flickering
        }, 50); // Small delay to ensure sequencing
      } else {
        // If deletion failed, don't change the UI state, just remove from loading state
        setDeletingPersonaIds(prev => {
          const next = new Set(Array.from(prev));
          next.delete(personaId);
          return next;
        });
        throw new Error(result.message || 'Failed to delete persona.');
      }
    } catch (err: any) {
      console.error('[PersonaTaggingModal] Error deleting persona:', err);
      const errorMessage = err.message || 'An unexpected error occurred during deletion.';
      toast.error(`Delete failed: ${errorMessage}`);
      
      // Ensure we remove from loading state on error
      setDeletingPersonaIds(prev => {
        const next = new Set(Array.from(prev));
        next.delete(personaId);
        return next;
      });
    }
  }, [personaToDelete, onDeleteSuccess]);

  return (
    <>
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
                    // NEW: Check if this persona is currently being deleted
                    const isBeingDeleted = deletingPersonaIds.has(persona.id);
                    return (
                      <Badge 
                        key={persona.id} 
                        className={cn(
                          "text-sm py-1 px-3 h-7 font-normal rounded-md border inline-flex items-center gap-1.5",
                          colorInfo.bg, 
                          colorInfo.text, 
                          colorInfo.border,
                          `hover:${colorInfo.bg}`, 
                          `hover:${colorInfo.text}`,
                          // NEW: Add opacity for personas being deleted
                          isBeingDeleted && "opacity-50"
                        )}
                      >
                        {persona.name}
                        {/* NEW: Show spinner for personas being deleted */}
                        {isBeingDeleted ? (
                          <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                        ) : (
                          <button
                            onClick={() => toggleSelection(persona.id)}
                            disabled={isLoading || isSuggesting || isBeingDeleted}
                            className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring 
                                     focus:ring-offset-2 disabled:opacity-50 hover:bg-background/10 p-0.5"
                          >
                            <LucideX className="h-3 w-3" />
                          </button>
                        )}
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
                      // NEW: Check both personaToDelete and deletingPersonaIds
                      const isBeingDeleted = deletingPersonaIds.has(persona.id);
                      const isThisBeingDeleted = isDeleting && personaToDelete?.id === persona.id;
                      
                      return (
                        <div key={persona.id} className="flex items-center justify-between w-full px-1 py-1 text-sm rounded-md">
                          {/* Button for selecting the persona */}
                          <button
                            onClick={() => {
                              toggleSelection(persona.id);
                              setInputValue('');
                            }}
                            disabled={isThisBeingDeleted || isSuggesting || isBeingDeleted}
                            className={cn(
                              "flex-grow text-left py-2 px-3 text-sm rounded-md cursor-pointer",
                              "transition-colors duration-150",
                              colorInfo.bg,
                              colorInfo.text,
                              colorInfo.border,
                              "hover:opacity-90 focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:outline-none",
                              (isThisBeingDeleted || isBeingDeleted) && "opacity-50 cursor-not-allowed"
                            )}
                            style={{ marginRight: '8px' }}
                          >
                            {persona.name}
                            {/* NEW: Show spinner if this persona is being deleted */}
                            {isBeingDeleted && (
                              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />
                            )}
                          </button>

                          {/* Delete Trigger Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPersonaToDelete(persona);
                            }}
                            disabled={isThisBeingDeleted || isSuggesting || isBeingDeleted}
                            className={cn(
                              "h-7 w-7 flex-shrink-0 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                              (isThisBeingDeleted || isBeingDeleted) && "opacity-50 cursor-not-allowed"
                            )}
                            aria-label={`Delete persona ${persona.name}`}
                          >
                            {/* NEW: Show spinner or trash icon based on deletion state */}
                            {isBeingDeleted ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
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
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={isLoading || isDeleting}
            >
              {isInitialTagging ? "Skip" : "Cancel"} 
            </Button>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={isLoading || isSuggesting || isDeleting || !hasChanges}
              className="min-w-[100px]"
            >
              {(isLoading || isSuggesting || isDeleting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Saving..." : isSuggesting ? "Suggesting..." : isDeleting ? "Deleting..." : "Save Personas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!personaToDelete} onOpenChange={(isOpen: boolean) => !isOpen && setPersonaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the persona tag
              <span className="font-semibold"> "{personaToDelete?.name}"</span>?
              <br />
              This action cannot be undone and will remove the tag from all associated interviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPersonaToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Persona
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
 