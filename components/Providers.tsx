"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
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

  // Tras hidratar (para no romper SSR), recupera las cachés pequeñas de localStorage
  // y mantenlas sincronizadas mientras dure la sesión.
  useEffect(() => {
    hydrateQueries(client);
    return attachQueryPersistence(client);
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      {/* Respeta "reducir movimiento" del sistema en todas las animaciones de framer-motion */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );
}
