"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TelemetryRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/live-timing");
  }, [router]);
  return null;
}
