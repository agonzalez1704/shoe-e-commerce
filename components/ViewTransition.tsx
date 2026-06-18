import * as React from "react";

// `unstable_ViewTransition` ships on recent React (paired with Next's
// experimental.viewTransition). If the installed React lacks it, degrade to a
// plain passthrough so pages still render — the morph just won't animate.
type VTProps = { name?: string; children: React.ReactNode };
const Impl = (React as unknown as { unstable_ViewTransition?: React.ComponentType<VTProps> })
  .unstable_ViewTransition;

export function ViewTransition({ name, children }: VTProps) {
  if (!Impl) return <>{children}</>;
  return <Impl name={name}>{children}</Impl>;
}
