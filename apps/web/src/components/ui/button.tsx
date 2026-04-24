import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  href,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps): JSX.Element {
  const classes = cn("button", `button--${variant}`, className);

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
