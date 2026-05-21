"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    getCurrentUser(token)
      .then((result) => setUser(result.user))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load user.");
        clearTokens();
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  function logout() {
    clearTokens();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <Link className="text-sm font-medium text-teal-700" href="/">
              Tutor Booking Platform
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
          </div>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white"
            onClick={logout}
            type="button"
          >
            Logout
          </button>
        </header>

        <div className="py-8">
          {isLoading ? <p className="text-sm text-slate-600">Loading...</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {user ? (
            <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Current user</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd className="mt-1 font-medium">{user.fullName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="mt-1 font-medium">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Role</dt>
                  <dd className="mt-1 font-medium">{user.role}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-1 font-medium">{user.status}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

