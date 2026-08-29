import Link from "next/link";
import { ReactNode } from "react";

export function ReportShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        {children}
      </section>
    </main>
  );
}

export function ReportHeader({
  role,
  title,
  description,
}: {
  role: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#007F83]">{role}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-slate-600">{description}</p>
      </div>
      <Link
        href="/reports"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        返回營運總覽
      </Link>
    </div>
  );
}

export function ReportFilters({ children }: { children: ReactNode }) {
  return (
    <form className="mt-6 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50 p-4">
      {children}
    </form>
  );
}

export const reportInputClassName =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900";
export const reportPrimaryButtonClassName =
  "rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00686b]";
export const reportSecondaryButtonClassName =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white";
export const reportExportButtonClassName =
  "rounded-lg border border-[#007F83] px-4 py-2 text-sm font-medium text-[#007F83] transition hover:bg-[#e6f4f4]";
