import type { ReactNode } from "react";

// Wrap the app in context providers (theme, query client, ...) here.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
