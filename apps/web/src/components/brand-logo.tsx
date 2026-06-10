"use client";

import Link from "next/link";

export function BrandLogo({
  className = "",
  href = "/",
  label = "TutorConnect",
  subtitle,
}: {
  className?: string;
  href?: string;
  label?: string;
  subtitle?: string;
}) {
  return (
    <Link className={`inline-flex min-w-0 items-center gap-2 text-[#004271] ${className}`} href={href}>
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center border-l border-current text-lg leading-none"
      >
        &#127891;
      </span>
      <span className="min-w-0">
        <span className="block truncate text-2xl font-bold leading-tight">{label}</span>
        {subtitle ? <span className="block truncate text-xs font-semibold text-current/70">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
