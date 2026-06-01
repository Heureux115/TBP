"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";
import { Conversation, deleteMessageForMe, getConversations, getMessages, hideConversation, Message, recallMessage, sendMessage } from "@/lib/message-api";
import { useHasMounted } from "@/lib/use-has-mounted";

function Icon({ name, fill = false, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return <span className={["material-symbols-outlined", fill ? "icon-fill" : "", className].join(" ")}>{name}</span>;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function conversationName(conversation: Conversation | null) {
  return conversation?.otherParticipant?.fullName || "Hội thoại TutorConnect";
}

export default function MessagesPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );

  const filteredConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return conversations;

    return conversations.filter((conversation) => {
      const name = conversationName(conversation).toLowerCase();
      const last = conversation.lastMessage?.body.toLowerCase() || "";
      return name.includes(keyword) || last.includes(keyword);
    });
  }, [conversations, query]);

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();

    if (!token) {
      router.replace("/auth/login");
      return;
    }

    const requestedConversationId = new URLSearchParams(window.location.search).get("conversationId");

    Promise.all([getCurrentUser(token), getConversations(token)])
      .then(([current, items]) => {
        setUser(current.user);
        setConversations(items);
        setSelectedId(requestedConversationId || items[0]?.id || null);
      })
      .catch((requestError) => {
        clearTokens();
        setError(requestError instanceof Error ? requestError.message : "Không thể tải hội thoại.");
      })
      .finally(() => setIsLoadingConversations(false));
  }, [hasMounted, router]);

  useEffect(() => {
    if (!hasMounted) return;
    const token = getAccessToken();
    if (!token || !selectedId) {
      return;
    }

    let active = true;
    const loadMessages = () => {
      getMessages(token, selectedId)
        .then((items) => {
          if (active) setMessages(items);
        })
        .catch((requestError) => {
          if (active) {
            setError(requestError instanceof Error ? requestError.message : "Không thể tải tin nhắn.");
          }
        });
    };

    loadMessages();
    const timer = window.setInterval(loadMessages, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasMounted, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  async function refreshConversations(token: string) {
    const items = await getConversations(token);
    setConversations(items);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    const content = body.trim();
    if (!token || !selectedId || !content || isSending) return;

    setIsSending(true);
    setError("");
    try {
      const message = await sendMessage(token, selectedId, content);
      setMessages((current) => [...current, message]);
      setBody("");
      await refreshConversations(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể gửi tin nhắn.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    const token = getAccessToken();
    if (!token || !selectedId || actionBusyId) return;

    setActionBusyId(messageId);
    setError("");
    try {
      await deleteMessageForMe(token, selectedId, messageId);
      setMessages((current) => current.filter((message) => message.id !== messageId));
      await refreshConversations(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xóa tin nhắn.");
    } finally {
      setActionBusyId("");
    }
  }

  async function handleRecallMessage(messageId: string) {
    const token = getAccessToken();
    if (!token || !selectedId || actionBusyId) return;

    setActionBusyId(messageId);
    setError("");
    try {
      await recallMessage(token, selectedId, messageId);
      setMessages((current) => current.filter((message) => message.id !== messageId));
      await refreshConversations(token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể gỡ tin nhắn.");
    } finally {
      setActionBusyId("");
    }
  }

  async function handleHideConversation() {
    const token = getAccessToken();
    if (!token || !selectedId || actionBusyId) return;

    setActionBusyId(selectedId);
    setError("");
    try {
      await hideConversation(token, selectedId);
      const nextConversations = conversations.filter((conversation) => conversation.id !== selectedId);
      setConversations(nextConversations);
      setSelectedId(nextConversations[0]?.id || null);
      if (!nextConversations.length) setMessages([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xóa hội thoại.");
    } finally {
      setActionBusyId("");
    }
  }

  if (!hasMounted || (isLoadingConversations && !user)) {
    return <MessagesSkeleton />;
  }

  return (
    <RoleDashboardShell active="messages" role={user?.role === "TUTOR" ? "tutor" : "student"}>
      <main className="flex h-[calc(100vh-64px)] bg-[var(--background)]">
        <section className="hidden w-80 shrink-0 flex-col border-r border-[var(--outline-variant)] bg-white md:flex">
          <div className="border-b border-[var(--outline-variant)] p-4">
            <h1 className="mb-4 text-xl font-black">Tin nhắn</h1>
            <label className="relative block">
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--outline)]" name="search" />
              <input
                className="w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-2 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm hội thoại..."
                type="text"
                value={query}
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <p className="p-5 text-sm text-[var(--on-surface-variant)]">Đang tải hội thoại...</p>
            ) : filteredConversations.length ? (
              filteredConversations.map((conversation) => (
                <ConversationButton
                  active={conversation.id === selectedId}
                  conversation={conversation}
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                />
              ))
            ) : (
              <div className="p-6 text-sm text-[var(--on-surface-variant)]">
                Chưa có hội thoại. Hãy mở tin nhắn từ một lịch học đã đặt.
              </div>
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-[var(--outline-variant)] px-5 md:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-[var(--primary)]">{conversationName(selected)}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-[var(--on-surface-variant)]">
                <span className="h-2 w-2 rounded-full bg-[var(--tertiary-fixed-dim)]" />
                <span>
                  {selected?.booking ? `Lịch học: ${formatDateTime(selected.booking.startsAt)}` : "Tin nhắn cập nhật mỗi 5 giây"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selected?.booking ? (
                <Link className="hidden items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2 lg:flex" href={selected?.booking ? `/bookings/${selected.booking.id}` : "/bookings"}>
                  <span className="rounded-lg bg-[var(--primary-container)]/10 p-2 text-[var(--primary)]">
                    <Icon className="text-[20px]" name="calendar_month" />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-[var(--on-surface-variant)]">Lịch học</span>
                    <span className="block text-sm font-black">{formatConversationTime(selected.booking.startsAt)}</span>
                  </span>
                  <span className="rounded bg-[var(--primary)] px-3 py-1 text-xs font-bold text-white">Xem</span>
                </Link>
              ) : null}
              <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--error)]/30 px-3 py-2 text-sm font-bold text-[var(--error)] hover:bg-[var(--error)]/5 disabled:opacity-50" disabled={!selectedId || actionBusyId === selectedId} onClick={handleHideConversation} type="button">
                <Icon name="delete" />
                Xóa hội thoại
              </button>
            </div>
          </header>

          {error ? (
            <p className="mx-5 mt-4 rounded-lg bg-[var(--error-container)] p-3 text-sm font-semibold text-[var(--on-error-container)]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[var(--surface)] p-5 md:p-6">
            {selectedId ? (
              <>
                <div className="flex justify-center">
                  <span className="rounded-full bg-[var(--surface-container-low)] px-4 py-1 text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">
                    Hôm nay
                  </span>
                </div>
                {messages.length ? (
                  messages.map((message) => (
                    <MessageBubble
                      actionBusy={actionBusyId === message.id}
                      key={message.id}
                      message={message}
                      onDelete={() => handleDeleteMessage(message.id)}
                      onRecall={() => handleRecallMessage(message.id)}
                      participantName={conversationName(selected)}
                    />
                  ))
                ) : (
                  <EmptyChat participantName={conversationName(selected)} />
                )}
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="max-w-md rounded-xl border border-dashed border-[var(--outline-variant)] bg-white p-8 text-center">
                  <Icon className="text-4xl text-[var(--primary)]" name="mail" />
                  <h2 className="mt-3 text-xl font-black">Chờn một hội thoại</h2>
                  <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                    Danh sách hội thoại sẽ xuất hiện khi bạn đặt lịch và nhắn tin với gia sư.
                  </p>
                </div>
              </div>
            )}
          </div>

          <form className="shrink-0 border-t border-[var(--outline-variant)] bg-white p-4 md:p-6" onSubmit={handleSend}>
            <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-2 transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/10">
              <textarea
                className="max-h-32 min-h-[44px] w-full resize-none border-none bg-transparent px-3 py-2 text-sm outline-none focus:ring-0"
                disabled={!selectedId}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Nhập tin nhắn..."
                rows={1}
                value={body}
              />
              <div className="mt-2 flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  <IconButton icon="sentiment_satisfied" label="Biểu cảm" />
                  <IconButton icon="attach_file" label="Đính kèm" />
                  <IconButton icon="image" label="Ảnh" />
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                  disabled={!selectedId || !body.trim() || isSending}
                  type="submit"
                >
                  {isSending ? "Đang gửi" : "Gửi"}
                  <Icon className="text-[18px]" name="send" />
                </button>
              </div>
            </div>
          </form>
        </section>

        <ContextPanel selected={selected} messages={messages} />
      </main>
    </RoleDashboardShell>
  );
}

function ConversationButton({ conversation, active, onClick }: { conversation: Conversation; active: boolean; onClick: () => void }) {
  const name = conversationName(conversation);
  return (
    <button
      className={`flex w-full cursor-pointer gap-3 border-b border-[var(--outline-variant)]/50 p-4 text-left transition ${active ? "border-r-4 border-r-[var(--primary)] bg-[var(--surface-container-high)]" : "hover:bg-[var(--surface-container-low)]"}`}
      onClick={onClick}
      type="button"
    >
      <div className="relative shrink-0">
        <Avatar name={name} />
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[var(--tertiary-fixed-dim)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-black">{name}</span>
          <span className="shrink-0 text-xs font-semibold text-[var(--on-surface-variant)]">
            {conversation.lastMessage ? formatConversationTime(conversation.lastMessage.createdAt) : ""}
          </span>
        </div>
        <p className="truncate text-sm text-[var(--on-surface-variant)]">
          {conversation.lastMessage?.body || "Chưa có tin nhắn."}
        </p>
      </div>
    </button>
  );
}

function MessageBubble({
  actionBusy,
  message,
  onDelete,
  onRecall,
  participantName,
}: {
  actionBusy: boolean;
  message: Message;
  onDelete: () => void;
  onRecall: () => void;
  participantName: string;
}) {
  const senderName = message.mine ? "Bạn" : participantName;

  if (message.mine) {
    return (
      <div className="flex max-w-[80%] flex-row-reverse gap-3 self-end">
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-2xl rounded-br-sm bg-[var(--primary)] p-4 text-white shadow-md">
            <p className="text-sm leading-6">{message.body}</p>
          </div>
          <div className="mr-2 flex items-center gap-1">
            <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{formatTime(message.createdAt)}</span>
            <Icon className="text-[14px] text-[var(--primary)]" fill name="done_all" />
          </div>
          <div className="mr-2 flex items-center gap-2">
            <button className="text-xs font-bold text-[var(--on-surface-variant)] hover:text-[var(--error)] disabled:opacity-50" disabled={actionBusy} onClick={onDelete} type="button">Xóa ở phía tôi</button>
            <button className="text-xs font-bold text-[var(--error)] hover:underline disabled:opacity-50" disabled={actionBusy} onClick={onRecall} type="button">Gỡ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[80%] gap-3">
      <Avatar name={senderName} small />
      <div className="flex flex-col gap-1">
        <div className="rounded-2xl rounded-bl-sm bg-[var(--surface-container-low)] p-4 shadow-sm">
          <p className="text-sm leading-6">{message.body}</p>
        </div>
        <div className="ml-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{formatTime(message.createdAt)}</span>
          <button className="text-xs font-bold text-[var(--on-surface-variant)] hover:text-[var(--error)] disabled:opacity-50" disabled={actionBusy} onClick={onDelete} type="button">Xóa ở phía tôi</button>
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ selected, messages }: { selected: Conversation | null; messages: Message[] }) {
  const name = conversationName(selected);
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-[var(--outline-variant)] bg-white p-4 xl:flex">
      <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-[var(--on-surface-variant)]">Thông tin liên quan</h3>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3">
          <Avatar name={name} large />
        </div>
        <h4 className="text-xl font-black text-[var(--primary)]">{name}</h4>
        <div className="mt-1 flex items-center justify-center gap-1 text-[var(--secondary)]">
          <Icon className="text-[18px]" fill name="star" />
          <span className="text-sm font-bold">TutorConnect</span>
        </div>
      </div>
      <div className="space-y-4">
        <article className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 shadow-sm">
          <h5 className="mb-3 text-sm font-black text-[var(--on-surface-variant)]">Lịch học</h5>
          {selected?.booking ? (
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-[var(--secondary-container)]/20 p-2 text-[var(--secondary)]">
                <Icon name="menu_book" />
              </span>
              <div>
                <p className="font-black">Buổi học đã đặt</p>
                <p className="text-sm text-[var(--on-surface-variant)]">{formatDateTime(selected.booking.startsAt)}</p>
                <p className="text-sm text-[var(--on-surface-variant)]">Trạng thái: {bookingStatusLabel(selected.booking.status)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--on-surface-variant)]">Hội thoại chưa gắn với lịch học.</p>
          )}
        </article>
        <article className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 shadow-sm">
          <h5 className="mb-3 text-sm font-black text-[var(--on-surface-variant)]">Thống kê nhanh</h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white p-3 text-center">
              <p className="text-2xl font-black text-[var(--primary)]">{messages.length}</p>
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Tin nhắn</p>
            </div>
            <div className="rounded-lg bg-white p-3 text-center">
              <p className="text-2xl font-black text-[var(--primary)]">0</p>
              <p className="text-xs font-semibold text-[var(--on-surface-variant)]">Tệp</p>
            </div>
          </div>
        </article>
        <Link className="block w-full rounded-xl border border-[var(--primary)] py-3 text-center text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary)]/5" href="/tutors">
          Đặt lịch tiếp theo
        </Link>
      </div>
    </aside>
  );
}

function EmptyChat({ participantName }: { participantName: string }) {
  return (
    <div className="mx-auto my-auto max-w-md rounded-xl border border-dashed border-[var(--outline-variant)] bg-white p-8 text-center">
      <Icon className="text-4xl text-[var(--primary)]" name="forum" />
      <h2 className="mt-3 text-xl font-black">Bắt đầu trao đổi với {participantName}</h2>
      <p className="mt-2 text-sm text-[var(--on-surface-variant)]">Tin nhắn mới sẽ được cập nhật tự động sau vài giây.</p>
    </div>
  );
}

function IconButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="rounded-full p-2 text-[var(--on-surface-variant)] transition hover:bg-[var(--surface-container-high)]" title={label} type="button">
      <Icon name={icon} />
    </button>
  );
}

function bookingStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Chờ gia sư xác nhận",
    CONFIRMED: "Đã xác nhận",
    CANCELLED: "Đã hủy",
    COMPLETED: "Đã hoàn thành",
  };
  return labels[status] || status;
}

function Avatar({ name, small = false, large = false }: { name: string; small?: boolean; large?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const size = large ? "h-24 w-24 text-3xl" : small ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full border border-[var(--outline-variant)] bg-[var(--primary-fixed)] font-black text-[var(--primary)]`}>
      {initial}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
        <h1 className="text-3xl font-black text-[var(--primary)]">Tin nhắn</h1>
        <section className="min-h-[620px] rounded-xl border border-[var(--outline-variant)] bg-white shadow-sm" />
      </div>
    </main>
  );
}
