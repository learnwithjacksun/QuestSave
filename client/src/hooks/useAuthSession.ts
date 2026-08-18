import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/config/clipApi";
import useAuthStore from "@/store/useAuthStore";
import { queryKeys } from "./queryKeys";

export default function useAuthSession() {
  const { setUser, setHydrated } = useAuthStore();
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.isPending) return;
    setUser(query.data ?? null);
    setHydrated(true);
  }, [query.data, query.isPending, query.isError, setHydrated, setUser]);
}
