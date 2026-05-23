"use client";

import { useEffect, useState } from "react";
import { SetupScreen } from "@/components/auth/SetupScreen";
import { ConnectDriveScreen } from "@/components/auth/ConnectDriveScreen";

export default function LoginPage() {
  const [state, setState] = useState<"loading" | "setup" | "connect">("loading");

  async function checkConfig() {
    try {
      const res = await fetch("/api/setup/check");
      const data = await res.json();
      setState(data.configured ? "connect" : "setup");
    } catch {
      setState("setup");
    }
  }

  useEffect(() => {
    checkConfig();
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "setup") {
    return <SetupScreen onComplete={() => setState("connect")} />;
  }

  return <ConnectDriveScreen />;
}
