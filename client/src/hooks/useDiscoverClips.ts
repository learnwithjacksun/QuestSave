import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchDiscoverClips } from "@/config/clipApi";
import { queryKeys } from "./queryKeys";

export function invalidateClipCaches(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.library });
  void client.invalidateQueries({ queryKey: queryKeys.discover });
}

export default function useDiscoverClips() {
  return useQuery({
    queryKey: queryKeys.discover,
    queryFn: fetchDiscoverClips,
    staleTime: 60_000,
  });
}

export function useInvalidateClipCaches() {
  const client = useQueryClient();
  return () => invalidateClipCaches(client);
}
