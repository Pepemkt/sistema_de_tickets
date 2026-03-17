"use client";

import { useEffect } from "react";
import type { AnalyticsStep } from "@/lib/analytics";
import { trackAnalyticsStep } from "@/lib/analytics-client";

interface Props {
  step: AnalyticsStep;
  eventSlug: string;
}

export function VisitTracker({ step, eventSlug }: Props) {
  useEffect(() => {
    trackAnalyticsStep({ step, eventSlug });
  }, [step, eventSlug]);

  return null;
}
