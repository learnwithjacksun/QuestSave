import { Sidebar, SidebarToggle } from "@/components/main";
import AuthOverlay from "@/components/auth/auth-overlay";
import ThemeToggle from "@/components/ui/theme-toggle";
import useSidebarStore from "@/store/useSidebarStore";
import useTheme from "@/hooks/useTheme";
import useAuthSession from "@/hooks/useAuthSession";
import clsx from "clsx";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  const { isOpen } = useSidebarStore();
  useTheme();
  useAuthSession();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />

      <main
        className={clsx(
          "flex-1 flex flex-col overflow-hidden transition-[margin] duration-200 ease-in-out",
          isOpen ? "md:ml-[260px]" : "md:ml-0"
        )}
      >
        <header className="flex items-center gap-2 px-4 py-3 shrink-0">
          <SidebarToggle />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <Outlet />
        </div>
      </main>
      <AuthOverlay />
    </div>
  );
}
