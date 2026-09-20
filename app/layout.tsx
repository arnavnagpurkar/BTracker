import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";

export const metadata: Metadata = { title: "BTracker" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0e1218", color: "#e7edf5" }}>
        <ClerkProvider
          afterSignOutUrl="/sign-in"
          appearance={{
            theme: dark,
            variables: { colorPrimary: "#a78bfa", borderRadius: "10px" },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
