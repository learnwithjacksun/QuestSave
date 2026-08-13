import { create } from "zustand"
import { persist } from "zustand/middleware"
interface ThemeStore{
    theme: "light" | "dark"
    setTheme: (theme: "light" | "dark") => void
}

const useThemeStore = create<ThemeStore>()(
    persist((set) => ({
        theme: "light",
        setTheme: (theme) => set({ theme }),
    }), {
        name: "theme",
        partialize: (state) => ({ theme: state.theme }),
    })
)

export default useThemeStore;
