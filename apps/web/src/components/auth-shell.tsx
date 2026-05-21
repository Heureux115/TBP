import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <Link className="mb-8 text-sm font-medium text-teal-700" href="/">
          Tutor Booking Platform
        </Link>
        <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

