"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils/cn";

type UserAvatarSize = "sm" | "md" | "lg" | "xl";

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  className?: string;
};

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "VA";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function UserAvatar({
  name,
  avatarUrl = null,
  size = "md",
  className,
}: UserAvatarProps): JSX.Element {
  const [hasImageError, setHasImageError] = useState(false);
  const initials = useMemo(() => getInitials(name), [name]);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  const shouldShowImage =
    typeof avatarUrl === "string" &&
    avatarUrl.trim().length > 0 &&
    hasImageError === false;

  return (
    <span
      aria-label={name}
      className={cn("user-avatar", `user-avatar--${size}`, className)}
      title={name}
    >
      {shouldShowImage ? (
        <img
          alt={name}
          className="user-avatar__image"
          onError={() => {
            setHasImageError(true);
          }}
          src={avatarUrl}
        />
      ) : (
        <span className="user-avatar__fallback">{initials}</span>
      )}
    </span>
  );
}
