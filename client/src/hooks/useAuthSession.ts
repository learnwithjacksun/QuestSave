import { useEffect } from "react";
import { fetchMe } from "@/config/clipApi";
import useAuthStore from "@/store/useAuthStore";

export default function useAuthSession() {
  const { setUser, setHydrated } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((user) => {
        if (mounted) setUser(user);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, [setUser, setHydrated]);
}
