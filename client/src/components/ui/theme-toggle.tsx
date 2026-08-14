import { useEffect, useRef, useState } from "react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { themeOptions, type ThemeMode } from "@/constants/themes";
import useTheme from "@/hooks/useTheme";
import Icon from "@/components/main/icon";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = themeOptions.find((item) => item.id === theme) ?? themeOptions[1];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: ThemeMode) => {
    setTheme(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 h-9 min-w-[100px] px-2 rounded-lg border border-line bg-input text-sm text-main hover:bg-hover transition-colors"
      >
        <div className="flex items-center gap-1 flex-1">
          <Icon icon={selected.icon} size={16} className="text-muted shrink-0" />
          <span className="text-left text-muted text-sm">{selected.label}</span>
        </div>
        <Icon
          icon={ArrowDown01Icon}
          size={16}
          className={clsx(
            "text-muted shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 w-full min-w-[140px] rounded-lg border border-line bg-surface p-1 shadow-lg z-50"
        >
          <ul className="space-y-0.5">
            {themeOptions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={theme === item.id}
                  onClick={() => handleSelect(item.id)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    theme === item.id
                      ? "bg-hover text-main"
                      : "text-main hover:bg-hover"
                  )}
                >
                  <Icon icon={item.icon} size={16} className="text-muted shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {theme === item.id && (
                    <Icon icon={Tick02Icon} size={14} className="text-primary shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
