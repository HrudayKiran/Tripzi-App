import { create } from 'zustand';

export type StructuredPlace = {
    id: string;
    name: string;
    day: number;
    order: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    time?: string;
    title?: string;
};

export type ChecklistItem = {
    id: string;
    text: string;
    checked: boolean;
    category: string;
};

export type CustomNote = {
    id: string;
    title: string;
    content: string;
    order: number;
};

interface ItineraryState {
    places: StructuredPlace[];
    tripDraft: any | null; // Keeps reference to active itinerary draft record
    checklist: ChecklistItem[];
    customCategories: string[];
    notes: CustomNote[];
    collaborators: any[];
    setPlaces: (places: StructuredPlace[]) => void;
    setTripDraft: (draft: any) => void;
    setChecklist: (checklist: ChecklistItem[]) => void;
    setCustomCategories: (categories: string[]) => void;
    setNotes: (notes: CustomNote[]) => void;
    setCollaborators: (collaborators: any[]) => void;
    clearDraft: () => void;
}

export const useItineraryStore = create<ItineraryState>((set) => ({
    places: [],
    tripDraft: null,
    checklist: [],
    customCategories: [],
    notes: [],
    collaborators: [],
    setPlaces: (places) => set({ places }),
    setTripDraft: (draft) => {
        if (draft) {
            let parsedChecklist: ChecklistItem[] = [];
            let parsedCategories: string[] = [];
            let parsedNotes: CustomNote[] = [];
            let parsedCollaborators: any[] = [];

            // 1. Unpack checklist if stored as JSON string or raw array
            if (draft.checklist) {
                try {
                    parsedChecklist = typeof draft.checklist === 'string'
                        ? JSON.parse(draft.checklist)
                        : draft.checklist;
                } catch (e) {
                    console.error('Failed to unpack checklist in setTripDraft:', e);
                }
            }

            // 2. Unpack notes
            if (draft.notes) {
                try {
                    parsedNotes = typeof draft.notes === 'string'
                        ? JSON.parse(draft.notes)
                        : draft.notes;
                } catch (e) {
                    console.error('Failed to unpack notes in setTripDraft:', e);
                }
            }

            // 3. Unpack participants/collaborators details
            if (draft.participants) {
                try {
                    parsedCollaborators = typeof draft.participants === 'string'
                        ? JSON.parse(draft.participants)
                        : draft.participants;
                } catch (e) {
                    console.error('Failed to unpack participants in setTripDraft:', e);
                }
            }

            // 4. Extract unique categories from checklists
            if (parsedChecklist.length > 0) {
                parsedCategories = [...new Set(parsedChecklist.map(item => item.category))];
            }

            set({
                tripDraft: draft,
                checklist: Array.isArray(parsedChecklist) ? parsedChecklist : [],
                customCategories: Array.isArray(parsedCategories) ? parsedCategories : [],
                notes: Array.isArray(parsedNotes) ? parsedNotes : [],
                collaborators: Array.isArray(parsedCollaborators) ? parsedCollaborators : []
            });
            return;
        }
        set({ tripDraft: draft });
    },
    setChecklist: (checklist) => set({ checklist }),
    setCustomCategories: (categories) => set({ customCategories: categories }),
    setNotes: (notes) => set({ notes }),
    setCollaborators: (collaborators) => set({ collaborators }),
    clearDraft: () => set({ places: [], tripDraft: null, checklist: [], customCategories: [], notes: [], collaborators: [] }),
}));
