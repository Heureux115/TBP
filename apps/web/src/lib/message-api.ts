import { applyAuthHeaders } from "./auth-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export type Conversation = {
  id: string;
  bookingId: string | null;
  otherParticipant: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  booking: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
  } | null;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderName: string;
    mine: boolean;
    attachments?: MessageAttachment[];
  } | null;
  updatedAt: string;
};

export type MessageAttachment = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: "IMAGE" | "DOCUMENT";
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
  };
  mine: boolean;
  attachments: MessageAttachment[];
};

async function request<T>(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  await applyAuthHeaders(headers, token, options.method || "GET");

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : "Request failed.";
    throw new Error(message);
  }

  return body as T;
}

export function getConversations(token: string) {
  return request<Conversation[]>("/messages/conversations", token);
}

export function ensureConversation(token: string, bookingId: string) {
  return request<Conversation>("/messages/conversations", token, {
    method: "POST",
    body: JSON.stringify({ bookingId }),
  });
}

export function getMessages(token: string, conversationId: string) {
  return request<Message[]>(`/messages/conversations/${conversationId}/messages`, token);
}

export function sendMessage(token: string, conversationId: string, body: string) {
  return request<Message>(`/messages/conversations/${conversationId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function sendMessageWithAttachments(token: string, conversationId: string, body: string, files: File[]) {
  const headers = new Headers();
  await applyAuthHeaders(headers, token, "POST");
  const formData = new FormData();
  formData.append("body", body);
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_URL}/messages/conversations/${conversationId}/messages`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(", ") : typeof payload?.message === "string" ? payload.message : "Request failed.";
    throw new Error(message);
  }

  return payload as Message;
}

export function deleteMessageForMe(token: string, conversationId: string, messageId: string) {
  return request<{ deleted: true }>(`/messages/conversations/${conversationId}/messages/${messageId}`, token, {
    method: "DELETE",
  });
}

export function recallMessage(token: string, conversationId: string, messageId: string) {
  return request<{ recalled: true }>(`/messages/conversations/${conversationId}/messages/${messageId}/recall`, token, {
    method: "PATCH",
  });
}

export function hideConversation(token: string, conversationId: string) {
  return request<{ hidden: true }>(`/messages/conversations/${conversationId}`, token, {
    method: "DELETE",
  });
}
