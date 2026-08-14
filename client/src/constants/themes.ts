import {
  Sun01Icon,
  Moon02Icon,
  ComputerIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export type ThemeMode = "light" | "dark" | "system";

export const themeOptions: {
  id: ThemeMode;
  label: string;
  icon: IconSvgElement;
}[] = [
  { id: "light", label: "Light", icon: Sun01Icon },
  { id: "dark", label: "Dark", icon: Moon02Icon },
  { id: "system", label: "System", icon: ComputerIcon },
];

export const defaultTheme: ThemeMode = "dark";

export const resolveTheme = (mode: ThemeMode): "light" | "dark" => {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
};
