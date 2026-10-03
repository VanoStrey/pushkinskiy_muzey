import { HomePage } from "@/pages/home";

import { Providers } from "./providers";
import "./styles/globals.css";

// The single place that decides which page is shown. Add a router here
// (e.g. `react-router`) when the app gets more than one page.
export function App() {
  return (
    <Providers>
      <HomePage />
    </Providers>
  );
}
