"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { readGift } from "@/lib/womansDay/giftLink";
import { WomansDayExperience } from "@/components/womans-day/WomansDayExperience";

/**
 * Gift-link parsing lives client-side: `output: "export"` prerenders this route to
 * static HTML, so there is no server `searchParams`. The Suspense boundary is required
 * by `useSearchParams` under static export.
 */
function WomansDayContent() {
  const searchParams = useSearchParams();
  const gift = readGift(Object.fromEntries(searchParams.entries()));
  return <WomansDayExperience gift={gift} />;
}

export default function WomansDayPage() {
  return (
    <Suspense>
      <WomansDayContent />
    </Suspense>
  );
}
