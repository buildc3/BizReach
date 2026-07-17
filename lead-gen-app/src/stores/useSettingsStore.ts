import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  apiUrl: string;
  followupDays: number;
  setApiUrl: (url: string) => void;
  setFollowupDays: (days: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: "http://127.0.0.1:3001",
      followupDays: 3,
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setFollowupDays: (followupDays) => set({ followupDays }),
    }),
    { name: "lead-gen-settings" }
  )
);
