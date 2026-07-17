import type { ApiResponse, Group, Lead, Message, Pitch, PitchMode, Product, Search, SenderProfile, Template, WhatsAppStatus } from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const json = await res.json();
  if (!res.ok) throw json; // throws ApiError shape
  return (json as ApiResponse<T>).data;
}

export const api = {
  products: {
    list: () => request<Product[]>("/api/v1/products"),
    get: (id: string) => request<Product>(`/api/v1/products/${id}`),
    aiFill: (rawDescription: string) =>
      request<{ name: string; description: string; category: string }>("/api/v1/products/fill", {
        method: "POST",
        body: JSON.stringify({ rawDescription }),
      }),
    create: (body: { name: string; description?: string; price?: number; category: string }) =>
      request<Product>("/api/v1/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; description?: string; price?: number; category: string; active: boolean }) =>
      request<Product>(`/api/v1/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request<string>(`/api/v1/products/${id}`, { method: "DELETE" }),
  },

  searches: {
    list: () => request<Search[]>("/api/v1/searches"),
    get: (id: string) => request<Search>(`/api/v1/searches/${id}`),
    create: (body: { name: string; bizType: string; area: string; productId?: string }) =>
      request<Search>("/api/v1/searches", { method: "POST", body: JSON.stringify(body) }),
    run: (id: string) => request<string>(`/api/v1/searches/${id}/run`, { method: "POST" }),
    delete: (id: string) => request<string>(`/api/v1/searches/${id}`, { method: "DELETE" }),
  },

  leads: {
    list: (searchId: string) => request<Lead[]>(`/api/v1/leads?search_id=${searchId}`),
    get: (id: string) => request<Lead>(`/api/v1/leads/${id}`),
    moveGroup: (leadId: string, groupId: string | null) =>
      request<Lead>(`/api/v1/leads/${leadId}/group`, {
        method: "PUT",
        body: JSON.stringify({ groupId }),
      }),
  },

  groups: {
    list: (searchId: string) => request<Group[]>(`/api/v1/groups?search_id=${searchId}`),
    create: (searchId: string, name: string) =>
      request<Group>("/api/v1/groups", { method: "POST", body: JSON.stringify({ searchId, name }) }),
    rename: (id: string, name: string) =>
      request<Group>(`/api/v1/groups/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    delete: (id: string) => request<string>(`/api/v1/groups/${id}`, { method: "DELETE" }),
    autoGroup: (searchId: string) =>
      request<Group[]>(`/api/v1/searches/${searchId}/autogroup`, { method: "POST" }),
  },

  templates: {
    list: () => request<Template[]>("/api/v1/templates"),
    create: (body: { name: string; body: string; productId?: string }) =>
      request<Template>("/api/v1/templates", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name: string; body: string; productId?: string }) =>
      request<Template>(`/api/v1/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    aiGenerate: (body: { productId: string; description: string }) =>
      request<string>("/api/v1/templates/generate", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request<string>(`/api/v1/templates/${id}`, { method: "DELETE" }),
    renderPitch: (templateId: string, leadId: string) =>
      request<string>(`/api/v1/templates/${templateId}/render/${leadId}`),
  },

  pitches: {
    generate: (body: { leadId: string; productId?: string; instructions?: string }) =>
      request<string>("/api/v1/pitches/generate", { method: "POST", body: JSON.stringify(body) }),
    listByGroup: (groupId: string) => request<Pitch[]>(`/api/v1/pitches?group_id=${groupId}`),
    generateBatch: (body: {
      groupId: string;
      mode: PitchMode;
      templateId?: string;
      productId?: string;
      instructions?: string;
    }) => request<string>("/api/v1/pitches/generate-batch", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: string) =>
      request<Message>(`/api/v1/pitches/${id}`, { method: "PUT", body: JSON.stringify({ body }) }),
    review: (id: string) => request<Message>(`/api/v1/pitches/${id}/review`, { method: "POST" }),
    reject: (id: string) => request<Message>(`/api/v1/pitches/${id}/reject`, { method: "POST" }),
    sendGroup: (groupId: string) =>
      request<{ queued: number }>("/api/v1/pitches/send-group", {
        method: "POST",
        body: JSON.stringify({ groupId }),
      }),
  },

  messages: {
    list: (leadId?: string) =>
      request<Message[]>(leadId ? `/api/v1/messages?lead_id=${leadId}` : "/api/v1/messages"),
    send: (body: { leadId: string; templateId: string }) =>
      request<Message>("/api/v1/messages/send", { method: "POST", body: JSON.stringify(body) }),
    followups: (olderThanDays = 3) =>
      request<Message[]>(`/api/v1/messages/followups?older_than_days=${olderThanDays}`),
  },

  settings: {
    getProfile: () => request<SenderProfile>("/api/v1/settings/profile"),
    updateProfile: (body: { yourName?: string | null; companyName?: string | null; phone?: string | null; website?: string | null }) =>
      request<SenderProfile>("/api/v1/settings/profile", { method: "PUT", body: JSON.stringify(body) }),
  },

  whatsapp: {
    status: () => request<WhatsAppStatus>("/api/v1/whatsapp/status"),
    logout: () => request<string>("/api/v1/whatsapp/logout", { method: "POST" }),
  },
};
