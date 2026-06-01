import { cn } from "@/shared/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-3", align === "center" && "text-center", className)}>
      {eyebrow ? <p className="text-sm uppercase tracking-[0.32em] text-primary">{eyebrow}</p> : null}
      <h2 className="font-display text-3xl font-semibold text-balance md:text-5xl">{title}</h2>
      {description ? <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p> : null}
    </div>
  );
}
