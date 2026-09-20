import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "radial-gradient(900px 500px at 10% -10%, rgba(167,139,250,.18), transparent 60%), radial-gradient(800px 500px at 100% 0%, rgba(76,201,240,.12), transparent 60%), #0e1218",
      }}
    >
      <SignUp />
    </div>
  );
}
