"use client";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

// The tracker runs in a same-origin frame. Clerk's profile button is drawn here, on top of
// an empty slot in the tracker's top bar, so it looks like part of the app.
export default function Home() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (d && d.type === "slot") setPos({ top: d.y, left: d.x });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Opening the menu (to sign out, say) first pushes any unsaved changes to the cloud.
  const flush = () => {
    try {
      (frame.current?.contentWindow as any)?.CLOUD?.flushNow();
    } catch {}
  };

  return (
    <>
      <iframe
        ref={frame}
        src="/tracker"
        title="BTracker"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#0e1218" }}
      />
      <div
        onClickCapture={flush}
        style={{
          position: "fixed",
          zIndex: 50,
          width: 34,
          height: 34,
          top: pos ? pos.top : 10,
          left: pos ? pos.left : undefined,
          right: pos ? undefined : 12,
          display: "grid",
          placeItems: "center",
        }}
      >
        <UserButton appearance={{ elements: { avatarBox: { width: 32, height: 32 } } }} />
      </div>
    </>
  );
}
