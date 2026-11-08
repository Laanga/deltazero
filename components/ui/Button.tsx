import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "tinted";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-f1red text-white shadow-[0_8px_24px_-8px_rgb(225_6_0/0.7),inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-f1red-bright",
  secondary: "fill-control text-ink hover:bg-white/10",
  tinted: "bg-f1red/15 text-red-300 shadow-[inset_0_0_0_1px_rgb(225_6_0/0.35)] hover:bg-f1red/25",
  ghost: "text-ink-2 hover:bg-white/[0.07] hover:text-ink",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2.5 px-6 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Botón en cápsula con pulsación tipo iOS. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`pressable inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tracking-wide disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
});

const ICON_SIZES: Record<Size, string> = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-11 w-11" };

/** Botón circular de solo icono. Requiere aria-label. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { "aria-label": string }>(
  function IconButton(
    { variant = "secondary", size = "md", className = "", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        title={props["aria-label"]}
        className={`pressable inline-flex shrink-0 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${ICON_SIZES[size]} ${className}`}
        {...props}
      />
    );
  },
);
