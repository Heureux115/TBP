"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth-storage";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead, type NotificationItem } from "@/lib/notification-api";

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

function formatNotificationTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

export function NotificationBell({
  buttonClassName = "relative rounded-full p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]",
  panelClassName = "absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-white shadow-xl",
  testId,
}: {
  buttonClassName?: string;
  panelClassName?: string;
  testId?: string;
}) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refreshNotifications() {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const result = await getMyNotifications(token);
      setUnreadCount(result.unreadCount);
      setItems(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void refreshNotifications());
  }, []);

  function handleToggle() {
    setOpen((current) => {
      const next = !current;
      if (next) void refreshNotifications();
      return next;
    });
  }

  async function handleReadNotification(item: NotificationItem) {
    const token = getAccessToken();
    if (!token) return;

    if (!item.readAt) {
      try {
        const updated = await markNotificationRead(token, item.id);
        setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        return;
      }
    }

    if (item.actionUrl) {
      setOpen(false);
      router.push(item.actionUrl);
    }
  }

  async function handleReadAll() {
    const token = getAccessToken();
    if (!token || loading) return;

    setLoading(true);
    setError("");
    try {
      const result = await markAllNotificationsRead(token);
      setUnreadCount(result.unreadCount);
      setItems(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể cập nhật thông báo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button aria-label="Thông báo" className={buttonClassName} data-testid={testId} onClick={handleToggle} type="button">
        <Icon name="notifications" />
        {unreadCount ? (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--error)] px-1 text-[10px] font-black leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <section className={panelClassName}>
          <div className="flex items-center justify-between border-b border-[var(--outline-variant)] px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-[var(--on-surface)]">Thông báo</h2>
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">
                {unreadCount ? `${unreadCount} chưa đọc` : "Không có thông báo mới"}
              </p>
            </div>
            <button className="rounded-lg px-3 py-2 text-xs font-black text-[var(--primary)] hover:bg-[var(--surface-container-low)] disabled:opacity-50" disabled={!unreadCount || loading} onClick={handleReadAll} type="button">
              Đọc tất cả
            </button>
          </div>
          {error ? <p className="m-3 rounded-lg bg-[var(--error-container)] p-3 text-xs font-bold text-[var(--error)]">{error}</p> : null}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && !items.length ? (
              <p className="p-5 text-sm font-semibold text-[var(--on-surface-variant)]">Đang tải thông báo...</p>
            ) : items.length ? (
              items.map((item) => (
                <button
                  className={`flex w-full gap-3 border-b border-[var(--outline-variant)] px-4 py-3 text-left hover:bg-[var(--surface-container-low)] ${item.readAt ? "bg-white" : "bg-[var(--primary-container)]/20"}`}
                  key={item.id}
                  onClick={() => handleReadNotification(item)}
                  type="button"
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-[var(--outline-variant)]" : "bg-[var(--primary)]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[var(--on-surface)]">{item.title}</span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--on-surface-variant)]">{item.body}</span>
                    <span className="mt-2 block text-[11px] font-bold text-[var(--outline)]">{formatNotificationTime(item.createdAt)}</span>
                  </span>
                  {item.actionUrl ? <Icon className="mt-4 text-base text-[var(--outline)]" name="chevron_right" /> : null}
                </button>
              ))
            ) : (
              <p className="p-5 text-sm font-semibold text-[var(--on-surface-variant)]">Chưa có thông báo nào.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
