/**
 * Minimal typed client for the handful of waxum REST API endpoints
 * this MCP server needs. Deliberately not the `@waxum/sdk` package —
 * that SDK doesn't yet cover groups/contacts/media/chat-history,
 * which are most of what this server calls, and pulling in a second
 * cross-repo dependency for the remaining overlap (sendText/sendImage
 * etc.) wasn't worth the coupling for this small a surface.
 */

export type MediaData = { data: string; mimetype: string };

export interface MessageMedia {
  direct_path: string;
  media_key: string;
  file_sha256: string;
  file_enc_sha256: string;
  file_length: number;
  media_type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mimetype: string;
}

export interface MessageHit {
  id: number;
  message_id: string;
  session_id: string;
  chat_jid: string;
  sender_jid: string;
  direction: 'in' | 'out';
  msg_type: string;
  body: string | null;
  snippet: string | null;
  msg_timestamp: string;
  push_name: string | null;
  media: MessageMedia | null;
  /** WhatsApp message id this message is replying to, or null if it isn't a reply. */
  quoted_message_id: string | null;
  /** Sender of the quoted message, or null if not a reply / not reported. */
  quoted_sender_jid: string | null;
}

export interface MessageSearchResponse {
  messages: MessageHit[];
  count: number;
}

export interface SendResponse {
  message_id: string;
  timestamp: number;
  to: string;
  status?: string;
  schedule_id?: string;
}

export interface GroupParticipant {
  jid: string;
  phone_number: string | null;
  role: 'member' | 'admin' | 'superadmin';
}

export interface GroupInfo {
  jid: string;
  subject: string;
  participants: GroupParticipant[];
  addressing_mode: string;
}

export interface GroupListResponse {
  groups: GroupInfo[];
  total: number;
}

export interface StoredContact {
  jid: string;
  phone: string | null;
  lid_jid: string | null;
  full_name: string | null;
  first_name: string | null;
  push_name: string | null;
  business_name: string | null;
  source: string;
  updated_at: string | null;
}

export interface StoredContactListResponse {
  contacts: StoredContact[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionStatusResponse {
  status: string;
  is_logged_in: boolean;
  phone_number: string | null;
  push_name: string | null;
}

export interface DownloadMediaResponse {
  data: string;
  size: number;
}

export class WaxumApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`waxum API error ${status}: ${body}`);
    this.name = 'WaxumApiError';
    this.status = status;
    this.body = body;
  }
}

export class WaxumClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new WaxumApiError(res.status, text);
    }
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  sendText(
    sessionId: string,
    body: { to: string; text: string; reply_to?: string },
  ): Promise<SendResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/messages/text`, body);
  }

  sendImage(
    sessionId: string,
    body: { to: string; image: MediaData; caption?: string; reply_to?: string },
  ): Promise<SendResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/messages/image`, body);
  }

  sendVideo(
    sessionId: string,
    body: { to: string; video: MediaData; caption?: string; reply_to?: string },
  ): Promise<SendResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/messages/video`, body);
  }

  sendAudio(
    sessionId: string,
    body: { to: string; audio: MediaData; ptt?: boolean; reply_to?: string },
  ): Promise<SendResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/messages/audio`, body);
  }

  sendDocument(
    sessionId: string,
    body: {
      to: string;
      document: MediaData;
      filename: string;
      caption?: string;
      reply_to?: string;
    },
  ): Promise<SendResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/messages/document`, body);
  }

  sendSticker(
    sessionId: string,
    body: { to: string; sticker: MediaData; reply_to?: string },
  ): Promise<SendResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/messages/sticker`, body);
  }

  listChatMessages(
    sessionId: string,
    chatJid: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<MessageSearchResponse> {
    const params = new URLSearchParams();
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return this.request(
      'GET',
      `/api/v1/sessions/${sessionId}/messages/chat/${encodeURIComponent(chatJid)}${qs ? `?${qs}` : ''}`,
    );
  }

  searchMessages(
    sessionId: string,
    q: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<MessageSearchResponse> {
    const params = new URLSearchParams({ q });
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.offset !== undefined) params.set('offset', String(opts.offset));
    return this.request(
      'GET',
      `/api/v1/sessions/${sessionId}/messages/search?${params.toString()}`,
    );
  }

  downloadMedia(sessionId: string, media: MessageMedia): Promise<DownloadMediaResponse> {
    return this.request('POST', `/api/v1/sessions/${sessionId}/media/download`, {
      direct_path: media.direct_path,
      media_key: media.media_key,
      file_sha256: media.file_sha256,
      file_enc_sha256: media.file_enc_sha256,
      file_length: media.file_length,
      media_type: media.media_type,
    });
  }

  listGroups(sessionId: string): Promise<GroupListResponse> {
    return this.request('GET', `/api/v1/sessions/${sessionId}/groups`);
  }

  listContacts(
    sessionId: string,
    opts: { q?: string; limit?: number; offset?: number } = {},
  ): Promise<StoredContactListResponse> {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return this.request('GET', `/api/v1/sessions/${sessionId}/contacts${qs ? `?${qs}` : ''}`);
  }

  getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    return this.request('GET', `/api/v1/sessions/${sessionId}/status`);
  }
}
