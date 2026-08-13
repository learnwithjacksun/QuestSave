import { useEffect } from "react";
import { useThemeStore } from "../store";

const useTheme = () => {
  const { theme, setTheme } = useThemeStore();

  const applyTheme = (value: "light" | "dark") => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(value);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  useEffect(() => {
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = theme || (systemPrefersDark ? "dark" : "light");

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, [setTheme, theme]);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  return { theme, toggleTheme };
};

export default useTheme;
