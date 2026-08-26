import { Dashboard } from "@/components/Dashboard";
import { Logo } from "@/components/Logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1">
        <Dashboard />
      </div>
      <footer className="py-5" style={{ background: "var(--brand)" }}>
        <div className="flex justify-center" style={{ color: "var(--brand-ink)" }}>
          <Logo className="h-6 w-auto" />
        </div>
      </footer>
    </main>
  );
}
