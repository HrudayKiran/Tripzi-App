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
    setTripDraft: (draft) => set({ tripDraft: draft }),
    setChecklist: (checklist) => set({ checklist }),
    setCustomCategories: (categories) => set({ customCategories: categories }),
    setNotes: (notes) => set({ notes }),
    setEssentials: (essentials) => set({ essentials }),
    setCollaborators: (collaborators) => set({ collaborators }),
    clearDraft: () => set({ places: [], tripDraft: null, checklist: [], customCategories: [], notes: [], essentials: [], collaborators: [] }),
}));
