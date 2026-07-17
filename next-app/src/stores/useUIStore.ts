import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activeSearchId: string | null;
  setActiveSearch: (id: string | null) => void;
  selectedLeadId: string | null;
  setSelectedLead: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  activeSearchId: null,
  setActiveSearch: (id) => set({ activeSearchId: id }),
  selectedLeadId: null,
  setSelectedLead: (id) => set({ selectedLeadId: id }),
}));
