import { Sidebar, SidebarToggle, DownloadProgressBar } from "@/components/main";
import AuthOverlay from "@/components/auth/auth-overlay";
import ThemeToggle from "@/components/ui/theme-toggle";
import useSidebarStore from "@/store/useSidebarStore";
import useTheme from "@/hooks/useTheme";
import useAuthSession from "@/hooks/useAuthSession";
import clsx from "clsx";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";

export default function MainLayout() {
  const { isOpen } = useSidebarStore();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const watchMode = pathname === "/fyp" && Boolean(searchParams.get("watch"));
  useTheme();
  useAuthSession();

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar hidden={watchMode} />
      {!watchMode && <DownloadProgressBar variant="global" />}

      <main
        className={clsx(
          "flex-1 flex flex-col overflow-hidden transition-[margin] duration-200 ease-in-out",
          isOpen && !watchMode ? "md:ml-[260px]" : "md:ml-0"
        )}
      >
        <header
          className={clsx(
            "flex items-center gap-2 px-4 py-3 shrink-0",
            watchMode && "hidden md:flex md:absolute md:top-0 md:right-0 md:z-20 md:bg-transparent"
          )}
        >
          {!watchMode && <SidebarToggle />}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div
          className={clsx(
            "flex-1 hide-scrollbar",
            watchMode ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          <Outlet />
        </div>
      </main>
      <AuthOverlay />
    </div>
  );
}