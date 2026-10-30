"use client";

import { usePathname } from "next/navigation";
import { isPortal, type Portal } from "@/lib/auth/portals";

// The portal in the current address (/manage/<portal>/...), for links built on the client.
export function usePortal(): Portal {
  const segment = usePathname().split("/")[2];
  return isPortal(segment) ? segment : "admin";
}
