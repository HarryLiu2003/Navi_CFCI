// frontend/src/lib/constants.ts

// Defines the available colors for persona tags.
// The 'id' is stored in the database.
// The CSS classes are used for display in the frontend.
export const PERSONA_COLORS = {
    gray: { id: 'gray', name: 'Gray', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100' },
    red: { id: 'red', name: 'Red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
    orange: { id: 'orange', name: 'Orange', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
    yellow: { id: 'yellow', name: 'Yellow', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-100' },
    green: { id: 'green', name: 'Green', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    teal: { id: 'teal', name: 'Teal', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
    blue: { id: 'blue', name: 'Blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    indigo: { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
    purple: { id: 'purple', name: 'Purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    pink: { id: 'pink', name: 'Pink', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100' },
  } as const; // 'as const' ensures keys and properties are treated as literal types
  
  // Type representing the valid color identifiers (e.g., 'gray', 'blue')
  export type PersonaColorId = keyof typeof PERSONA_COLORS;
  
  // An array of the color objects, useful for iterating (e.g., for a selector UI)
  export const PERSONA_COLOR_OPTIONS = Object.values(PERSONA_COLORS);
  
  // Default color ID to use if none is specified or found
  export const DEFAULT_PERSONA_COLOR_ID: PersonaColorId = 'gray';
  
  // Utility function to get the color object from an ID, falling back to default
  export function getPersonaColorById(colorId: string | null | undefined): typeof PERSONA_COLORS[PersonaColorId] {
    if (colorId && colorId in PERSONA_COLORS) {
      return PERSONA_COLORS[colorId as PersonaColorId];
    }
    return PERSONA_COLORS[DEFAULT_PERSONA_COLOR_ID];
  }
  
  // Utility function to get a random color ID (excluding gray maybe?)
  export function getRandomPersonaColorId(excludeGray: boolean = true): PersonaColorId {
      const options = excludeGray 
          ? PERSONA_COLOR_OPTIONS.filter(c => c.id !== 'gray') 
          : PERSONA_COLOR_OPTIONS;
      if (options.length === 0) return DEFAULT_PERSONA_COLOR_ID; // Fallback if all excluded
      const randomIndex = Math.floor(Math.random() * options.length);
      return options[randomIndex].id;
  } 