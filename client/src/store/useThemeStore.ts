import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultTheme, type ThemeMode } from "@/constants/themes";

interface ThemeStore {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: defaultTheme,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "theme",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

export default useThemeStore;
