import { AdminTutorsScreen } from "@/components/admin/admin-tutors-screen";

type ScreenState = "list" | "loading" | "error" | "empty";

const states: Record<string, ScreenState> = {
  loading: "loading",
  error: "error",
  empty: "empty",
  list: "list",
};

export default async function AdminTutorsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const params = await searchParams;
  const initialState = params.state ? states[params.state] : "list";

  return <AdminTutorsScreen initialState={initialState || "list"} />;
}
