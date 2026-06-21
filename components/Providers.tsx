"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { attachQueryPersistence, hydrateQueries } from "@/lib/persistQueries";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false },
        },
      }),
  );

  // Tras hidratar (para no romper SSR), recupera calendario/standings de localStorage
  // y mantén esa caché sincronizada mientras dure la sesión.
  useEffect(() => {
    hydrateQueries(client);
    return attachQueryPersistence(client);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
