import { QueryClient } from "@tanstack/react-query";
import { apiGet } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: ({ queryKey }) => apiGet(queryKey.join("/")),
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
