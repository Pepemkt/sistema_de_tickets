"use client";

import { useEffect } from "react";

export function PrelineClient() {
  useEffect(() => {
    import("preline/preline").then(() => {
      const anyWindow = window as typeof window & {
        HSStaticMethods?: { autoInit: () => void };
      };

      anyWindow.HSStaticMethods?.autoInit();
    });
  }, []);

  return null;
}
