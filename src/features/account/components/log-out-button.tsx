"use client";

import { Button } from "@/components/ui/button";
import { useLogOut } from "@/features/auth/components/use-log-out";

/** Settings → Account, at the very end: an outlined "Log out", no icon. */
export function LogOutButton() {
  const { pending, logOutNow } = useLogOut();
  return (
    <Button
      variant="transparent"
      className="w-fit border-[1.5px] border-line"
      disabled={pending}
      onClick={logOutNow}
    >
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
