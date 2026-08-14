import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarStore {
  isOpen: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: "sidebar",
      partialize: (state) => ({ isOpen: state.isOpen }),
    }
  )
);

export default useSidebarStore;
