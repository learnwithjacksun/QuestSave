export default function Pattern({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background relative overflow-y-scroll">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
    linear-gradient(to right, var(--foreground) 1px, transparent 1px),
    linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)
  `,
          backgroundSize: "20px 30px",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
