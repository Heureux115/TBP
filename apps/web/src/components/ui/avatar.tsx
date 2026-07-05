"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "./utils";

type AvatarSize = "lg" | "md" | "sm" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  lg: "h-14 w-14 text-xl",
  md: "h-10 w-10 text-sm",
  sm: "h-8 w-8 text-xs",
  xl: "h-24 w-24 text-3xl",
};

const API_ASSET_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace(/\/api\/v1\/?$/, "");

function resolveAvatarSrc(src?: null | string) {
  if (!src) return "";
  if (src.startsWith("/uploads/")) return `${API_ASSET_ORIGIN}${src}`;
  return src;
}

export function Avatar({
  className = "",
  name,
  size = "md",
  src,
}: {
  className?: string;
  name: string;
  size?: AvatarSize;
  src?: null | string;
}) {
  const [failedSrc, setFailedSrc] = useState<null | string>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const imageSrc = resolveAvatarSrc(src);
  const showImage = Boolean(imageSrc) && failedSrc !== imageSrc;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--outline-variant)] bg-[var(--primary-fixed)] font-black text-[var(--primary)]",
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        <Image alt={name} className="object-cover" fill onError={() => setFailedSrc(imageSrc)} sizes="96px" src={imageSrc} unoptimized />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
