import { create } from 'zustand';

type StructuredPlace = {
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

interface TripState {
    places: StructuredPlace[];
    tripDraft: any | null;
    checklist: { id: string; text: string; checked: boolean; category: string }[];
    customCategories: string[];
    notes: { id: string; title: string; content: string; order: number }[];
    essentials: { id: string; text: string; packed: boolean }[];
    collaborators: any[];
    setPlaces: (places: StructuredPlace[]) => void;
    setTripDraft: (draft: any) => void;
    setChecklist: (checklist: { id: string; text: string; checked: boolean; category: string }[]) => void;
    setCustomCategories: (categories: string[]) => void;
    setNotes: (notes: { id: string; title: string; content: string; order: number }[]) => void;
    setEssentials: (essentials: { id: string; text: string; packed: boolean }[]) => void;
    setCollaborators: (collaborators: any[]) => void;
    clearDraft: () => void;
}

export const useTripStore = create<TripState>((set) => ({
    places: [],
    tripDraft: null,
    checklist: [],
    customCategories: [],
    notes: [],
    essentials: [],
    collaborators: [],
    setPlaces: (places) => set({ places }),
    setTripDraft: (draft) => {
        if (draft && draft.mandatory_items) {
            try {
                const items = typeof draft.mandatory_items === 'string'
                    ? JSON.parse(draft.mandatory_items)
                    : draft.mandatory_items;
                
                if (Array.isArray(items) && items.length >= 5) {
                    const parsedChecklist = typeof items[0] === 'string' ? JSON.parse(items[0]) : items[0];
                    const parsedCategories = typeof items[1] === 'string' ? JSON.parse(items[1]) : items[1];
                    const parsedNotes = typeof items[2] === 'string' ? JSON.parse(items[2]) : items[2];
                    const parsedEssentials = typeof items[3] === 'string' ? JSON.parse(items[3]) : items[3];
                    const parsedCollaborators = typeof items[4] === 'string' ? JSON.parse(items[4]) : items[4];
                    
                    set({
                        tripDraft: draft,
                        checklist: Array.isArray(parsedChecklist) ? parsedChecklist : [],
                        customCategories: Array.isArray(parsedCategories) ? parsedCategories : [],
                        notes: Array.isArray(parsedNotes) ? parsedNotes : [],
                        essentials: Array.isArray(parsedEssentials) ? parsedEssentials : [],
                        collaborators: Array.isArray(parsedCollaborators) ? parsedCollaborators : []
                    });
                    return;
                }
            } catch (e) {
                console.error('Failed to unpack custom itinerary details in setTripDraft:', e);
            }
        }
        set({ tripDraft: draft });
    },
    setChecklist: (checklist) => set({ checklist }),
    setCustomCategories: (categories) => set({ customCategories: categories }),
    setNotes: (notes) => set({ notes }),
    setEssentials: (essentials) => set({ essentials }),
    setCollaborators: (collaborators) => set({ collaborators }),
    clearDraft: () => set({ places: [], tripDraft: null, checklist: [], customCategories: [], notes: [], essentials: [], collaborators: [] }),
}));
