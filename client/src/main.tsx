import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { applyTheme } from "@/hooks/useTheme";
import { defaultTheme, type ThemeMode } from "@/constants/themes";

const queryClient = new QueryClient();

try {
  const stored = localStorage.getItem("theme");
  if (stored) {
    const parsed = JSON.parse(stored) as { state?: { theme?: ThemeMode } };
    applyTheme(parsed.state?.theme ?? defaultTheme);
  } else {
    applyTheme(defaultTheme);
  }
} catch {
  applyTheme(defaultTheme);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
