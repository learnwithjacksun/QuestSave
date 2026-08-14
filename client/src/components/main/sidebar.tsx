import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Search01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { navItems } from "@/constants/navigation";
import { fetchSavedClips } from "@/config/clipApi";
import useSidebarStore from "@/store/useSidebarStore";
import useAuthStore from "@/store/useAuthStore";
import type { SavedClip } from "@/types/clip";
import Icon from "./icon";

export default function Sidebar() {
  const { isOpen, toggle, setOpen } = useSidebarStore();
  const { user, openOverlay } = useAuthStore();
  const [query, setQuery] = useState("");
  const [savedClips, setSavedClips] = useState<SavedClip[]>([]);

  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!user) {
      setSavedClips([]);
      return;
    }
    fetchSavedClips()
      .then(setSavedClips)
      .catch(() => setSavedClips([]));
  }, [user]);

  const filteredNavItems = useMemo(() => {
    if (!normalizedQuery) return navItems;
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredRecents = useMemo(() => {
    if (!normalizedQuery) return savedClips;
    return savedClips.filter((clip) => {
      const haystack = `${clip.title} ${clip.author} ${clip.platform}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, savedClips]);

  const hasResults =
    filteredNavItems.length > 0 || filteredRecents.length > 0;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed top-0 left-0 z-40 h-full w-[260px] flex flex-col bg-sidebar border-r border-line transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3">
          <NavLink
            to="/"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-hover transition-colors"
          >
            <div>
                <img src="/logo.svg" alt="QuestSave" className="size-7" />
            </div>
            <span className="font-semibold text-main text-[15px]">QuestSave</span>
          </NavLink>

          <button
            onClick={toggle}
            title="Close sidebar"
            className="h-9 w-9 center rounded-lg text-muted hover:text-main hover:bg-hover transition-colors"
          >
            <Icon icon={PanelLeftCloseIcon} size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3">
          <div className="relative flex items-center">
            <Icon
              icon={Search01Icon}
              size={16}
              className="absolute left-3 text-muted pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saves"
              className="w-full rounded-lg focus:bg-hover pl-9 pr-9 py-2.5 text-sm text-main placeholder:text-muted ring-1 ring-line focus:ring-1 focus:ring-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                title="Clear search"
                className="absolute right-2 h-7 w-7 rounded-md text-muted hover:text-main hover:bg-background/50 transition-colors"
              >
                <Icon icon={Cancel01Icon} size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        {filteredNavItems.length > 0 && (
        <nav className="px-3 mt-2 flex flex-col gap-0.5">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={() => window.innerWidth < 768 && setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-white font-medium"
                    : "text-main hover:bg-hover"
                )
              }
            >
              <Icon icon={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        )}

        {/* Recents */}
        {(filteredRecents.length > 0 || !normalizedQuery) && (
        <div className="flex-1 overflow-hidden flex flex-col mt-4 px-3 min-h-0">
          <NavLink
            to="/saves"
            onClick={() => window.innerWidth < 768 && setOpen(false)}
            className="px-3 py-1.5 text-xs text-muted font-medium hover:text-main transition-colors"
          >
            {normalizedQuery ? "Results" : "Recent Saves"}
          </NavLink>

          {user ? (
            <ul className="flex-1 overflow-y-auto hide-scrollbar space-y-0.5">
              {filteredRecents.length === 0 && !normalizedQuery && (
                <li className="px-3 py-2 text-sm text-muted">No saves yet</li>
              )}
              {filteredRecents.map((clip) => (
                <li key={clip.id}>
                  <NavLink
                    to={`/saves?id=${encodeURIComponent(clip.id)}`}
                    onClick={() => window.innerWidth < 768 && setOpen(false)}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-main hover:bg-hover transition-colors truncate"
                  >
                    {clip.title || clip.sourceUrl}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={openOverlay}
              className="mt-1 text-left px-3 py-2 rounded-lg text-sm text-muted hover:text-main hover:bg-hover transition-colors"
            >
              Sign in to see your saves
            </button>
          )}
        </div>
        )}

        {!hasResults && normalizedQuery && (
          <div className="flex-1 px-6 py-4">
            <p className="text-sm text-muted">No results found</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-line">
          <button
            onClick={() => {
              if (!user) openOverlay();
            }}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-hover transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-primary/20 center text-primary text-xs font-semibold shrink-0">
              {(user?.username || "G").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-main truncate">
                {user?.username || "Guest User"}
              </p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle() {
  const { isOpen, toggle } = useSidebarStore();

  if (isOpen) return null;

  return (
    <button
      onClick={toggle}
      title="Open sidebar"
      className="h-9 w-9 center rounded-lg text-muted hover:text-main hover:bg-hover transition-colors"
    >
      <Icon icon={PanelLeftOpenIcon} size={20} />
    </button>
  );
}
