import { useEffect } from "react";
import { defaultTheme, resolveTheme, type ThemeMode } from "@/constants/themes";
import { useThemeStore } from "../store";

export const applyTheme = (mode: ThemeMode) => {
  const resolved = resolveTheme(mode);
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
};

const useTheme = () => {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    applyTheme(theme || defaultTheme);

    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  return { theme, setTheme };
};

export default useTheme;
