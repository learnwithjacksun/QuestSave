import { useQuery } from "@tanstack/react-query";
import { fetchReceivedShares, fetchSavedClips } from "@/config/clipApi";
import useAuthStore from "@/store/useAuthStore";
import { queryKeys } from "./queryKeys";

export default function useLibraryData() {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: queryKeys.library,
    queryFn: async () => {
      const [clips, shares] = await Promise.all([fetchSavedClips(), fetchReceivedShares()]);
      return { clips, shares };
    },
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}
