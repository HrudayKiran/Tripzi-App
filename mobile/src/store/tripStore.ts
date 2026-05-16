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
    checklist: { id: string; text: string; checked: boolean }[];
    notes: string;
    essentials: { id: string; text: string; packed: boolean }[];
    setPlaces: (places: StructuredPlace[]) => void;
    setTripDraft: (draft: any) => void;
    setChecklist: (checklist: { id: string; text: string; checked: boolean }[]) => void;
    setNotes: (notes: string) => void;
    setEssentials: (essentials: { id: string; text: string; packed: boolean }[]) => void;
    clearDraft: () => void;
}

export const useTripStore = create<TripState>((set) => ({
    places: [],
    tripDraft: null,
    checklist: [],
    notes: '',
    essentials: [],
    setPlaces: (places) => set({ places }),
    setTripDraft: (draft) => set({ tripDraft: draft }),
    setChecklist: (checklist) => set({ checklist }),
    setNotes: (notes) => set({ notes }),
    setEssentials: (essentials) => set({ essentials }),
    clearDraft: () => set({ places: [], tripDraft: null, checklist: [], notes: '', essentials: [] }),
}));
