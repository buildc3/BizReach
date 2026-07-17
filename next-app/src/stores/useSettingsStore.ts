import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  followupDays: number;
  setFollowupDays: (days: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      followupDays: 3,
      setFollowupDays: (followupDays) => set({ followupDays }),
    }),
    { name: "lead-gen-settings" },
  ),
);
