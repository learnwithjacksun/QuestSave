import ModeToggle from "@/components/ui/mode-toggle";
import { Pattern } from "@/components/ui";
import { libraries } from "@/constants/data";
import { Github, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <>
      <Pattern>
        <div className="h-[100dvh] relative z-10 center flex-col gap-10 text-center layout">
          <div className="center gap-2">
            <a
              href="https://github.com/learnwithjacksun/my-react-template"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-line rounded-full bg-secondary/70 px-4 py-2 center gap-20 inline-flex "
            >
              <div className="center gap-2">
                <Github size={18} className="text-main/70" />
                <p className="text-sm">Use Template</p>
              </div>
              <ArrowRight size={20} className="text-main/70" />
            </a>
          </div>
          <div className="space-y-2">
            <h1 className="text-6xl md:leading-[80px] leading-[60px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-main to-main/70 dark:to-main/50">
              My Reactjs Template
            </h1>
            <p className="text-muted text-sm">With typescript.</p>
          </div>

          <ul className="center flex-wrap gap-2">
            {libraries.map((library) => (
              <li
                key={library}
                className="text-sm text-muted dark:bg-secondary border border-line rounded-full px-4 py-2"
              >
                {library}
              </li>
            ))}
          </ul>
          <ModeToggle />
        </div>
      </Pattern>
    </>
  );
}
