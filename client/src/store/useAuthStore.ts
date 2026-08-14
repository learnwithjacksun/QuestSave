import { create } from "zustand";
import type { AuthUser } from "@/types/clip";

interface AuthStore {
  user: AuthUser | null;
  hydrated: boolean;
  isOverlayOpen: boolean;
  pendingSave: boolean;
  setUser: (user: AuthUser | null) => void;
  setHydrated: (hydrated: boolean) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  setPendingSave: (pending: boolean) => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  hydrated: false,
  isOverlayOpen: false,
  pendingSave: false,
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ hydrated }),
  openOverlay: () => set({ isOverlayOpen: true }),
  closeOverlay: () => set({ isOverlayOpen: false }),
  setPendingSave: (pendingSave) => set({ pendingSave }),
}));

export default useAuthStore;
