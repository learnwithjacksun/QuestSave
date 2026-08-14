import {
  siFacebook,
  siInstagram,
  siPinterest,
  siX,
  siYoutube,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

interface FloatingIcon {
  icon: SimpleIcon;
  className: string;
  delay: string;
}

const platforms: FloatingIcon[] = [
  // { icon: siTiktok, className: "top-[12%] left-[8%] size-10", delay: "0s" },
  { icon: siYoutube, className: "top-[20%] right-[10%] size-11", delay: "1.2s" },
  { icon: siInstagram, className: "top-[56%] left-[4%] size-10", delay: "2.4s" },
  { icon: siX, className: "top-[48%] right-[5%] size-9", delay: "0.8s" },
  { icon: siPinterest, className: "bottom-[16%] left-[14%] size-10", delay: "1.8s" },
  { icon: siFacebook, className: "bottom-[14%] right-[12%] size-10", delay: "2.8s" },
];

function BrandIcon({ icon }: { icon: SimpleIcon }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[42%] text-current"
    >
      <path fill="currentColor" d={icon.path} />
    </svg>
  );
}

export default function FloatingPlatforms() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {platforms.map(({ icon, className, delay }) => (
        <div
          key={icon.slug}
          className={`absolute center opacity-50 float-soft ${className}`}
          style={{ animationDelay: delay, color: `#${icon.hex}` }}
        >
          <BrandIcon icon={icon} />
        </div>
      ))}
    </div>
  );
}
