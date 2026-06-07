export const dynamic = "force-dynamic";

import { Header } from "@/components/Dashboard/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f]">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
