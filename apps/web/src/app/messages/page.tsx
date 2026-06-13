"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { RoleDashboardShell } from "@/components/layouts/role-dashboard-shell";
import { Avatar, Button, Card, CardDescription, CardHeader, CardTitle, Dialog, FeedbackState, Icon, Skeleton, StatusBadge } from "@/components/ui";
import { getCurrentUser, PublicUser } from "@/lib/api";
import { clearTokens, getAccessToken, isCookieSessionToken } from "@/lib/auth-storage";
import { Conversation, deleteMessageForMe, getConversations, getMessages, hideConversation, Message, MessageAttachment, recallMessage, sendMessageWithAttachments } from "@/lib/message-api";
import { createSearchMatcher } from "@/lib/search-text";
import { useHasMounted } from "@/lib/use-has-mounted";

type PendingDialog =
  | { message: Message; type: "delete-message" | "recall-message" }
  | { type: "hide-conversation" }
  | null;

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function socketUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1").replace(/\/api\/v1\/?$/, "");
}

function uploadUrl(url: string) {
  if (url.startsWith("/uploads/")) return `${socketUrl()}${url}`;
  return url;
}

function upsertMessage(messages: Message[], incoming: Message) {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages.map((message) => (message.id === incoming.id ? incoming : message));
  }

  return [...messages, incoming];
}

function conversationName(conversation: Conversation | null) {
  return conversation?.otherParticipant?.fullName || "Hội thoại TutorConnect";
}

function conversationSubtitle(conversation: Conversation | null) {
  if (!conversation) return "Chọn một hội thoại để bắt đầu.";
  if (conversation.booking) return `Lịch học: ${formatDateTime(conversation.booking.startsAt)}`;
  return conversation.otherParticipant?.email || "Tin nhắn realtime";
}

function bookingStatusMeta(status: string): { label: string; tone: "danger" | "info" | "neutral" | "success" | "warning" } {
  const labels: Record<string, { label: string; tone: "danger" | "info" | "neutral" | "success" | "warning" }> = {
    PENDING: { label: "Chờ xác nhận", tone: "warning" },
    CONFIRMED: { label: "Đã xác nhận", tone: "info" },
    CANCELLED: { label: "Đã hủy", tone: "danger" },
    COMPLETED: { label: "Đã hoàn thành", tone: "success" },
  };

  return labels[status] || { label: status, tone: "neutral" };
}

function groupMessagesByDate(messages: Message[]) {
  return messages.reduce<Array<{ date: string; items: Message[] }>>((groups, message) => {
    const date = formatDate(message.createdAt);
    const last = groups[groups.length - 1];
    if (last?.date === date) {
      last.items.push(message);
      return groups;
    }

    groups.push({ date, items: [message] });
    return groups;
  }, []);
}

export default function MessagesPage() {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );

  const filteredConversations = useMemo(() => {
    const matchesQuery = createSearchMatcher(query);

    return conversations.filter((conversation) => {
      const haystack = `${conversationName(conversation)} ${conversation.otherParticipant?.email || ""} ${conversation.bookingId || ""} ${conversation.lastMessage?.body || ""}`;
      return matchesQuery(haystack);
    });
  }, [conversations, query]);

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

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
        setMobileThreadOpen(Boolean(requestedConversationId));
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
    if (!token) return;

    const socket = io(socketUrl(), {
      auth: isCookieSessionToken(token) ? undefined : { token },
      withCredentials: true,
    });

    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", () => setSocketConnected(false));
    socket.on("message:new", (message: Message) => {
      setMessages((current) => upsertMessage(current, message));
    });
    socket.on("message:recalled", (payload: { messageId: string }) => {
      setMessages((current) => current.filter((message) => message.id !== payload.messageId));
    });
    socket.on("message:deletedForMe", (payload: { messageId: string }) => {
      setMessages((current) => current.filter((message) => message.id !== payload.messageId));
    });
    socket.on("conversation:updated", () => {
      const currentToken = getAccessToken();
      if (currentToken) void refreshConversations(currentToken);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [hasMounted]);

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
    socketRef.current?.emit("conversation:join", { conversationId: selectedId });

    return () => {
      active = false;
      socketRef.current?.emit("conversation:leave", { conversationId: selectedId });
    };
  }, [hasMounted, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  async function refreshConversations(token: string) {
    try {
      const items = await getConversations(token);
      setConversations(items);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Không thể đồng bộ hội thoại.";
      if (message === "Unauthorized") {
        clearTokens();
        setUser(null);
        router.replace("/auth/login");
        return;
      }
      setError(message);
    }
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setMobileThreadOpen(true);
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    const content = body.trim();
    if (!token || !selectedId || (!content && !selectedFiles.length) || isSending) return;

    setIsSending(true);
    setError("");
    try {
      const message = await sendMessageWithAttachments(token, selectedId, content, selectedFiles);
      setMessages((current) => upsertMessage(current, message));
      setBody("");
      setSelectedFiles([]);
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
      setPendingDialog(null);
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
      setPendingDialog(null);
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
      setMobileThreadOpen(false);
      setPendingDialog(null);
      if (!nextConversations.length) setMessages([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể ẩn hội thoại.");
    } finally {
      setActionBusyId("");
    }
  }

  async function confirmPendingAction() {
    if (!pendingDialog) return;
    if (pendingDialog.type === "hide-conversation") {
      await handleHideConversation();
      return;
    }
    if (pendingDialog.type === "delete-message") {
      await handleDeleteMessage(pendingDialog.message.id);
      return;
    }
    await handleRecallMessage(pendingDialog.message.id);
  }

  if (!hasMounted || (isLoadingConversations && !user)) {
    return <MessagesSkeleton />;
  }

  if (error && !user && !conversations.length) {
    return (
      <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
        <div className="mx-auto max-w-[720px] pt-12">
          <FeedbackState
            action={
              <Link className="inline-flex" href="/dashboard">
                <span className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--primary)]">
                  Quay lại dashboard
                </span>
              </Link>
            }
            description={error}
            title="Không thể tải tin nhắn"
            tone="error"
          />
        </div>
      </main>
    );
  }

  return (
    <RoleDashboardShell active="messages" role={user?.role === "TUTOR" ? "tutor" : "student"}>
      <main className="h-[calc(100dvh-64px)] overflow-hidden bg-[var(--surface)] text-[var(--on-surface)]">
        <div className="grid h-full w-full grid-cols-1 overflow-hidden bg-white md:grid-cols-[320px_minmax(0,1fr)] md:border-b md:border-[var(--outline-variant)] xl:grid-cols-[320px_minmax(420px,1fr)_280px] 2xl:grid-cols-[340px_minmax(520px,1fr)_300px]">
          <ConversationList
            conversations={filteredConversations}
            isLoading={isLoadingConversations}
            onClearSearch={() => setQuery("")}
            onSelect={selectConversation}
            query={query}
            selectedId={selectedId}
            setQuery={setQuery}
            show={!mobileThreadOpen}
            totalCount={conversations.length}
          />

          <ChatThread
            actionBusyId={actionBusyId}
            body={body}
            error={error}
            isSending={isSending}
            messageGroups={messageGroups}
            messagesEndRef={messagesEndRef}
            mobileThreadOpen={mobileThreadOpen}
            onBack={() => setMobileThreadOpen(false)}
            onBodyChange={setBody}
            onDelete={(message) => setPendingDialog({ message, type: "delete-message" })}
            onFilesChange={setSelectedFiles}
            onHideConversation={() => setPendingDialog({ type: "hide-conversation" })}
            onRecall={(message) => setPendingDialog({ message, type: "recall-message" })}
            onSend={handleSend}
            selected={selected}
            selectedId={selectedId}
            selectedFiles={selectedFiles}
            socketConnected={socketConnected}
          />

          <ContextPanel messages={messages} selected={selected} />
        </div>

        <DangerActionDialog
          busy={Boolean(actionBusyId)}
          onClose={() => setPendingDialog(null)}
          onConfirm={confirmPendingAction}
          pending={pendingDialog}
        />
      </main>
    </RoleDashboardShell>
  );
}

function ConversationList({
  conversations,
  isLoading,
  onClearSearch,
  onSelect,
  query,
  selectedId,
  setQuery,
  show,
  totalCount,
}: {
  conversations: Conversation[];
  isLoading: boolean;
  onClearSearch: () => void;
  onSelect: (id: string) => void;
  query: string;
  selectedId: string | null;
  setQuery: (value: string) => void;
  show: boolean;
  totalCount: number;
}) {
  return (
    <section className={`${show ? "flex" : "hidden"} min-h-0 flex-col border-r border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] md:flex`}>
      <header className="border-b border-[var(--outline-variant)] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[var(--primary)]">Tin nhắn</h1>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">{totalCount} hội thoại</p>
          </div>
          <StatusBadge tone="success">{isLoading ? "Đang tải" : "Realtime"}</StatusBadge>
        </div>
        <label className="relative block">
          <span className="sr-only">Tìm hội thoại</span>
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--on-surface-variant)]" name="search" />
          <input
            className="w-full rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên, email, nội dung..."
            type="search"
            value={query}
          />
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length ? (
          conversations.map((conversation) => (
            <ConversationButton
              active={conversation.id === selectedId}
              conversation={conversation}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            />
          ))
        ) : query ? (
          <div className="p-5">
            <FeedbackState
              actionLabel="Xóa tìm kiếm"
              className="min-h-[220px]"
              description="Không có hội thoại nào khớp với từ khóa hiện tại."
              onAction={onClearSearch}
              title="Không tìm thấy hội thoại"
              tone="not-found"
            />
          </div>
        ) : (
          <div className="p-5">
            <FeedbackState
              action={
                <Link className="inline-flex" href="/bookings">
                  <span className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white">
                    Xem lịch học
                  </span>
                </Link>
              }
              className="min-h-[260px]"
              description="Hội thoại sẽ xuất hiện khi bạn đặt lịch và nhắn tin với gia sư hoặc học viên."
              title="Chưa có hội thoại"
              tone="empty"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ConversationButton({ conversation, active, onClick }: { conversation: Conversation; active: boolean; onClick: () => void }) {
  const name = conversationName(conversation);
  const bookingMeta = conversation.booking ? bookingStatusMeta(conversation.booking.status) : null;
  const fromOther = conversation.lastMessage && !conversation.lastMessage.mine;

  return (
    <button
      aria-pressed={active}
      className={[
        "group flex w-full gap-3 border-b border-[var(--outline-variant)]/60 p-4 text-left transition",
        active ? "bg-[var(--primary-fixed)]/55" : "hover:bg-[var(--surface-container-low)]",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <div className="relative shrink-0">
        <Avatar name={name} size="md" />
        {fromOther ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--primary)]" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-black text-[var(--on-surface)]">{name}</span>
          <span className="shrink-0 text-xs font-semibold text-[var(--on-surface-variant)]">
            {conversation.lastMessage ? formatConversationTime(conversation.lastMessage.createdAt) : formatConversationTime(conversation.updatedAt)}
          </span>
        </div>
        <p className={["truncate text-sm", fromOther ? "font-bold text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]"].join(" ")}>
          {conversation.lastMessage ? `${conversation.lastMessage.mine ? "Bạn: " : ""}${conversation.lastMessage.body}` : "Chưa có tin nhắn."}
        </p>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          {bookingMeta ? (
            <StatusBadge tone={bookingMeta.tone}>{bookingMeta.label}</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Chưa gắn lịch</StatusBadge>
          )}
          {conversation.booking ? <span className="truncate text-xs font-semibold text-[var(--on-surface-variant)]">{formatDate(conversation.booking.startsAt)}</span> : null}
        </div>
      </div>
    </button>
  );
}

function ChatThread({
  actionBusyId,
  body,
  error,
  isSending,
  messageGroups,
  messagesEndRef,
  mobileThreadOpen,
  onBack,
  onBodyChange,
  onDelete,
  onFilesChange,
  onHideConversation,
  onRecall,
  onSend,
  selected,
  selectedId,
  selectedFiles,
  socketConnected,
}: {
  actionBusyId: string;
  body: string;
  error: string;
  isSending: boolean;
  messageGroups: Array<{ date: string; items: Message[] }>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  mobileThreadOpen: boolean;
  onBack: () => void;
  onBodyChange: (value: string) => void;
  onDelete: (message: Message) => void;
  onFilesChange: (files: File[]) => void;
  onHideConversation: () => void;
  onRecall: (message: Message) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  selected: Conversation | null;
  selectedId: string | null;
  selectedFiles: File[];
  socketConnected: boolean;
}) {
  return (
    <section className={`${mobileThreadOpen ? "flex" : "hidden"} min-h-0 min-w-0 flex-col border-r border-[var(--outline-variant)] bg-white md:flex`}>
      <header className="flex min-h-[76px] shrink-0 flex-col gap-3 border-b border-[var(--outline-variant)] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <Button aria-label="Quay lại danh sách hội thoại" className="md:hidden" onClick={onBack} size="icon" variant="ghost">
            <Icon name="arrow_back" />
          </Button>
          <Avatar name={conversationName(selected)} size="md" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-black text-[var(--primary)]">{conversationName(selected)}</h2>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--on-surface-variant)]">{conversationSubtitle(selected)}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
          {selected?.booking ? <BookingLink conversation={selected} /> : null}
          <Button disabled={!selectedId || actionBusyId === selectedId} leftIcon={<Icon name="delete" />} onClick={onHideConversation} size="sm" variant="danger">
            Xóa đoạn chat
          </Button>
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-4 rounded-[var(--radius-md)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm font-bold text-[var(--status-danger-text)] md:mx-6" role="alert">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-container-lowest)] px-4 py-5 md:px-5">
        {selectedId ? (
          messageGroups.length ? (
            <div className="flex flex-col gap-5">
              {messageGroups.map((group) => (
                <div className="flex flex-col gap-3" key={group.date}>
                  <DateSeparator>{group.date}</DateSeparator>
                  {group.items.map((message) => (
                    <MessageBubble
                      actionBusy={actionBusyId === message.id}
                      key={message.id}
                      message={message}
                      onDelete={() => onDelete(message)}
                      onRecall={() => onRecall(message)}
                      participantName={conversationName(selected)}
                    />
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <EmptyChat participantName={conversationName(selected)} />
          )
        ) : (
          <NoConversationSelected />
        )}
      </div>

      <Composer
        body={body}
        disabled={!selectedId}
        isSending={isSending}
        onBodyChange={onBodyChange}
        onFilesChange={onFilesChange}
        onSend={onSend}
        selectedFiles={selectedFiles}
        socketConnected={socketConnected}
      />
    </section>
  );
}

function BookingLink({ conversation }: { conversation: Conversation }) {
  const booking = conversation.booking;
  if (!booking) return null;

  const meta = bookingStatusMeta(booking.status);

  return (
    <Link
      className="flex min-w-0 max-w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2"
      href={`/bookings/${booking.id}`}
    >
      <span className="shrink-0 rounded-[var(--radius-md)] bg-[var(--primary-fixed)] p-2 text-[var(--primary)]">
        <Icon className="text-[20px]" name="calendar_month" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-[var(--on-surface-variant)]">Lịch học</span>
        <span className="block truncate text-sm font-black">{formatConversationTime(booking.startsAt)}</span>
      </span>
      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
    </Link>
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
      <div className="flex w-full justify-end">
        <div className="flex max-w-[86%] flex-col items-end gap-1 sm:max-w-[74%]">
          <div className="rounded-[18px] rounded-br-[6px] bg-[var(--primary)] px-4 py-3 text-white shadow-[var(--shadow-panel)]">
            {message.body ? <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p> : null}
            <AttachmentGrid attachments={message.attachments || []} mine />
          </div>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1 pr-1">
            <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{formatTime(message.createdAt)}</span>
            <Icon className="text-[14px] text-[var(--primary)]" fill name="done_all" />
            <button className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--on-surface-variant)] hover:text-[var(--error)] disabled:opacity-50" disabled={actionBusy} onClick={onDelete} type="button">
              Xóa ở phía tôi
            </button>
            <button className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--error)] hover:underline disabled:opacity-50" disabled={actionBusy} onClick={onRecall} type="button">
              Gỡ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[88%] gap-3 sm:max-w-[76%]">
        <Avatar name={senderName} size="sm" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="rounded-[18px] rounded-bl-[6px] border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 shadow-[var(--shadow-panel)]">
            {message.body ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--on-surface)]">{message.body}</p> : null}
            <AttachmentGrid attachments={message.attachments || []} />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1">
            <span className="text-xs font-semibold text-[var(--on-surface-variant)]">{formatTime(message.createdAt)}</span>
            <button className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--on-surface-variant)] hover:text-[var(--error)] disabled:opacity-50" disabled={actionBusy} onClick={onDelete} type="button">
              Xóa ở phía tôi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ selected, messages }: { selected: Conversation | null; messages: Message[] }) {
  const name = conversationName(selected);
  const booking = selected?.booking || null;
  const meta = booking ? bookingStatusMeta(booking.status) : null;
  const attachments = messages.flatMap((message) => message.attachments || []);
  const images = attachments.filter((attachment) => attachment.kind === "IMAGE");
  const documents = attachments.filter((attachment) => attachment.kind === "DOCUMENT");

  return (
    <aside className="hidden min-h-0 flex-col border-l border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 xl:flex">
      <div className="min-h-0 overflow-y-auto">
        <Card className="text-center">
          <Avatar className="mx-auto" name={name} size="xl" />
          <h3 className="mt-4 text-xl font-black text-[var(--primary)]">{name}</h3>
          <p className="mt-1 truncate text-sm text-[var(--on-surface-variant)]">{selected?.otherParticipant?.email || "TutorConnect"}</p>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <div>
              <CardTitle className="text-lg">Lịch học liên quan</CardTitle>
              <CardDescription>Ngữ cảnh để hai bên trao đổi đúng buổi học.</CardDescription>
            </div>
          </CardHeader>
          {booking && meta ? (
            <div className="space-y-3">
              <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
              <InfoLine icon="event" label="Bắt đầu" value={formatDateTime(booking.startsAt)} />
              <InfoLine icon="schedule" label="Kết thúc" value={formatDateTime(booking.endsAt)} />
              <Link className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white" href={`/bookings/${booking.id}`}>
                Xem lịch học
              </Link>
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--on-surface-variant)]">Hội thoại này chưa gắn với lịch học cụ thể.</p>
          )}
        </Card>

        <Card className="mt-4">
          <CardTitle className="text-lg">Tệp đã gửi</CardTitle>
          {attachments.length ? (
            <div className="mt-4 space-y-4">
              {images.length ? (
                <div>
                  <p className="mb-2 text-xs font-black uppercase text-[var(--on-surface-variant)]">Ảnh</p>
                  <div className="grid grid-cols-3 gap-2">
                    {images.slice(0, 9).map((attachment) => (
                      <a className="block overflow-hidden rounded-[var(--radius-md)] border border-[var(--outline-variant)]" href={uploadUrl(attachment.url)} key={attachment.id} rel="noreferrer" target="_blank">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={attachment.fileName} className="h-16 w-full object-cover" src={uploadUrl(attachment.url)} />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {documents.length ? (
                <div>
                  <p className="mb-2 text-xs font-black uppercase text-[var(--on-surface-variant)]">Tài liệu</p>
                  <div className="space-y-2">
                    {documents.slice(0, 6).map((attachment) => (
                      <a className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-container-low)] px-3 py-2 text-sm font-bold text-[var(--primary)]" href={uploadUrl(attachment.url)} key={attachment.id} rel="noreferrer" target="_blank">
                        <Icon className="shrink-0 text-[18px]" name="description" />
                        <span className="truncate">{attachment.fileName}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-[var(--radius-md)] border border-dashed border-[var(--outline-variant)] p-3 text-sm font-semibold text-[var(--on-surface-variant)]">
              Chưa có tệp nào trong cuộc trò chuyện này.
            </p>
          )}
        </Card>
      </div>
    </aside>
  );
}

function AttachmentGrid({ attachments, mine = false }: { attachments: MessageAttachment[]; mine?: boolean }) {
  if (!attachments.length) return null;

  return (
    <div className={["mt-3 grid gap-2", attachments.length === 1 ? "grid-cols-1" : "grid-cols-2"].join(" ")}>
      {attachments.map((attachment) =>
        attachment.kind === "IMAGE" ? (
          <a
            className="block overflow-hidden rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white/90"
            href={uploadUrl(attachment.url)}
            key={attachment.id}
            rel="noreferrer"
            target="_blank"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={attachment.fileName} className="h-32 w-full object-cover" src={uploadUrl(attachment.url)} />
          </a>
        ) : (
          <a
            className={[
              "flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-bold",
              mine ? "border-white/40 bg-white/15 text-white" : "border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-[var(--primary)]",
            ].join(" ")}
            href={uploadUrl(attachment.url)}
            key={attachment.id}
            rel="noreferrer"
            target="_blank"
          >
            <Icon className="shrink-0 text-[20px]" name="description" />
            <span className="truncate">{attachment.fileName}</span>
          </a>
        ),
      )}
    </div>
  );
}

function Composer({
  body,
  disabled,
  isSending,
  onBodyChange,
  onFilesChange,
  onSend,
  selectedFiles,
  socketConnected,
}: {
  body: string;
  disabled: boolean;
  isSending: boolean;
  onBodyChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  selectedFiles: File[];
  socketConnected: boolean;
}) {
  const canSend = !disabled && Boolean(body.trim() || selectedFiles.length);

  return (
    <form className="shrink-0 border-t border-[var(--outline-variant)] bg-white p-3" onSubmit={onSend}>
      <div className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-2 transition focus-within:border-[var(--primary)] focus-within:shadow-[var(--focus-ring)]">
        {selectedFiles.length ? (
          <div className="mb-2 flex flex-wrap gap-2 px-2">
            {selectedFiles.map((file, index) => (
              <span className="inline-flex max-w-full items-center gap-2 rounded-[var(--radius-full)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--on-surface)]" key={`${file.name}-${index}`}>
                <Icon className="text-[16px] text-[var(--primary)]" name={file.type.startsWith("image/") ? "image" : "description"} />
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button aria-label={`Bỏ ${file.name}`} className="rounded-full text-[var(--on-surface-variant)] hover:text-[var(--error)]" onClick={() => onFilesChange(selectedFiles.filter((_, fileIndex) => fileIndex !== index))} type="button">
                  <Icon className="text-[16px]" name="close" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <label className="sr-only" htmlFor="message-body">
          Nhập tin nhắn
        </label>
        <div className="flex min-w-0 items-end gap-2">
          <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-[var(--primary)] transition hover:bg-white">
            <span className="sr-only">Đính kèm tệp</span>
            <Icon name="attach_file" />
            <input
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
              className="hidden"
              disabled={disabled}
              multiple
              onChange={(event) => {
                onFilesChange(Array.from(event.target.files || []).slice(0, 5));
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <textarea
            className="max-h-28 min-h-11 min-w-0 flex-1 resize-none border-none bg-transparent px-3 py-2 text-sm leading-6 text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
            disabled={disabled}
            id="message-body"
            onChange={(event) => onBodyChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={disabled ? "Chọn một hội thoại để nhắn tin" : "Nhập tin nhắn..."}
            rows={1}
            value={body}
          />
          <Button disabled={!canSend} isLoading={isSending} rightIcon={<Icon className="text-[18px]" name="send" />} type="submit">
            Gửi
          </Button>
        </div>
        <p className="mt-1 hidden px-3 text-xs font-semibold text-[var(--on-surface-variant)] sm:block">
          {socketConnected ? "Realtime đã kết nối. Enter để gửi, Shift + Enter để xuống dòng." : "Đang kết nối realtime lại. Tin nhắn vẫn gửi được qua API."}
        </p>
      </div>
    </form>
  );
}

function DangerActionDialog({
  busy,
  onClose,
  onConfirm,
  pending,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: PendingDialog;
}) {
  if (!pending) return null;

  const meta =
    pending.type === "hide-conversation"
      ? {
          confirmLabel: "Xóa đoạn chat",
          description: "Đoạn chat này sẽ bị xóa khỏi danh sách tin nhắn của bạn. Người còn lại vẫn có thể thấy nội dung cũ, và hội thoại có thể xuất hiện lại nếu có tin nhắn mới.",
          title: "Xóa đoạn trò chuyện này?",
        }
      : pending.type === "recall-message"
        ? {
            confirmLabel: "Gỡ tin nhắn",
            description: "Tin nhắn đã gửi sẽ được gỡ khỏi hội thoại nếu hệ thống cho phép. Hành động này có thể ảnh hưởng đến ngữ cảnh trao đổi.",
            title: "Gỡ tin nhắn đã gửi?",
          }
        : {
            confirmLabel: "Xóa tin nhắn",
            description: "Tin nhắn sẽ chỉ bị xóa ở phía bạn. Người còn lại có thể vẫn thấy nội dung này.",
            title: "Xóa tin nhắn này?",
          };

  return (
    <Dialog
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      description={meta.description}
      onClose={onClose}
      open
      role="alertdialog"
      title={meta.title}
    >
      {"message" in pending ? (
        <div className="p-6">
          <div className="rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-sm leading-6 text-[var(--on-surface-variant)]">
            {pending.message.body}
          </div>
        </div>
      ) : null}
      <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
        <Button data-dialog-initial-focus disabled={busy} onClick={onClose} variant="outline">
          Giữ lại
        </Button>
        <Button isLoading={busy} onClick={onConfirm} variant="danger">
          {meta.confirmLabel}
        </Button>
      </footer>
    </Dialog>
  );
}

function DateSeparator({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-[var(--radius-full)] border border-[var(--outline-variant)] bg-white px-3 py-1 text-xs font-bold text-[var(--on-surface-variant)] shadow-[var(--shadow-panel)]">
        {children}
      </span>
    </div>
  );
}

function EmptyChat({ participantName }: { participantName: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <FeedbackState
        className="min-h-[320px] max-w-lg"
        description={`Gửi lời nhắn đầu tiên cho ${participantName}. Tin nhắn mới sẽ xuất hiện realtime khi hai bên đang online.`}
        icon="forum"
        title="Bắt đầu trao đổi"
        tone="empty"
      />
    </div>
  );
}

function NoConversationSelected() {
  return (
    <div className="flex h-full items-center justify-center">
      <FeedbackState
        className="min-h-[320px] max-w-lg"
        description="Chọn một hội thoại ở danh sách bên trái để xem tin nhắn và ngữ cảnh lịch học."
        icon="mail"
        title="Chọn một hội thoại"
        tone="empty"
      />
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="rounded-[var(--radius-md)] bg-[var(--surface-container-low)] p-2 text-[var(--primary)]">
        <Icon className="text-[18px]" name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-[var(--on-surface-variant)]">{label}</p>
        <p className="break-words text-sm font-black">{value}</p>
      </div>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Đang tải hội thoại">
      {Array.from({ length: 7 }).map((_, index) => (
        <div className="flex gap-3" key={index}>
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--surface)] px-5 py-8 text-[var(--on-surface)] md:px-10">
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-5 h-11 w-full" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className="h-14 w-full" key={index} />
            ))}
          </div>
        </Card>
        <Card>
          <Skeleton className="h-10 w-64" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="ml-auto h-16 w-1/2" />
            <Skeleton className="h-16 w-3/5" />
            <Skeleton className="ml-auto h-16 w-2/3" />
          </div>
          <Skeleton className="mt-10 h-24 w-full" />
        </Card>
      </div>
    </main>
  );
}
