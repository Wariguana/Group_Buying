import { redirect } from "next/navigation";

import { AdminNav } from "@/app/Navbar/nav";
import { getCurrentUser } from "@/app/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav username={user.username} role={user.role} />

      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}