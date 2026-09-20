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
          localization={{
            signIn: { start: { title: "Sign in to BTracker" } },
            signUp: { start: { title: "Create your BTracker account" } },
          }}
          appearance={{
            theme: dark,
            variables: { colorPrimary: "#a78bfa", borderRadius: "10px" },
            elements: {
              footer: "hidden",
              footerAction: "hidden",
              // The account-menu popover and the "Manage account" (UserProfile)
              // view each have their own footer element.
              userButtonPopoverFooter: "hidden",
              userButtonPopoverFooterPagesLink: "hidden",
              profileSectionFooter: "hidden",
            },
          }}
        >
          {children}
        </ClerkProvider>
        {/* Belt-and-suspenders: Clerk's internal class names shift between
            versions and surfaces, so this layer doesn't rely on guessing
            every one of them. It hides by (a) any class Clerk generates
            that contains "footer" on a cl-* element, and (b) the badge's
            actual link target, which is constant everywhere the badge
            appears: sign-in, sign-up, the account popover, and the
            "Manage account" profile view. */}
        <style>{`
          [class*="cl-"][class*="ooter"],
          [class*="cl-"][class*="Footer"],
          a[href*="clerk.com"] {
            display: none !important;
          }
          /* collapse any leftover gap left by the now-empty footer wrapper */
          [class*="cl-"][class*="ooter"]:empty,
          [class*="cl-"][class*="Footer"]:empty {
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            min-height: 0 !important;
          }
        `}</style>
      </body>
    </html>
  );
}