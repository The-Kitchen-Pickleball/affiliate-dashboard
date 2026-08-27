import { Dashboard } from "@/components/Dashboard";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1">
        <Dashboard />
      </div>
      <footer className="py-6" style={{ background: "var(--footer-bg)" }}>
        <div className="flex justify-center" style={{ color: "var(--footer-logo)" }}>
          <Logo className="h-9 w-auto" />
        </div>
      </footer>
    </main>
  );
}
