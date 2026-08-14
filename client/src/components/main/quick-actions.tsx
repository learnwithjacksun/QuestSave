import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { navItems } from "@/constants/navigation";
import Icon from "./icon";

export default function QuickActions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-full border border-line text-sm text-main hover:bg-hover transition-colors",
              isActive && "bg-primary/10 border-primary/10 text-primary"
            )
          }
        >
          <Icon icon={item.icon} size={16} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
