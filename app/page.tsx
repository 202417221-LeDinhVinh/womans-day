"use client";

import { useEffect } from "react";

/**
 * Apex entry: send the reader (and any gift query string) to the celebration route.
 * `output: "export"` cannot use server redirects, so this is a client hand-off.
 */
export default function Home() {
  useEffect(() => {
    window.location.replace(`/womans-day${window.location.search}`);
  }, []);
  return null;
}
