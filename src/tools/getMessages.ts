import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ctx } from '../context.js';
import type { MessageHit } from '../waxumClient.js';

export function registerGetMessages(server: McpServer, ctx: Ctx): void {
  server.tool(
    'get_messages',
    'Read message history for a chat or group. Without `q`, returns the most recent messages newest-first. With `q`, full-text searches that keyword within the chat instead. Each message includes the sender\'s push_name (display name), a `media` object for media messages (pass it whole to download_media to fetch the file), and `quoted_message_id`/`quoted_sender_jid` when the message is a reply — a bare "yes" or "this one" makes no sense on its own, so when those are non-null, find the quoted message (match `quoted_message_id` against another message\'s `message_id` in this same history, fetching more history if it is not already in the page you have) before answering or acting on the reply.',
    {
      chat_jid: z.string().describe('Chat JID (DM partner or group JID)'),
      q: z.string().optional().describe('Keyword to search for within this chat, instead of listing recent messages'),
      limit: z.number().int().min(1).max(200).optional().describe('Page size (default 20, max 200)'),
      offset: z.number().int().min(0).optional().describe('Rows to skip (default 0)'),
    },
    async ({ chat_jid, q, limit, offset }) => {
      const result = q
        ? await ctx.client.searchMessages(ctx.sessionId, q, { limit, offset })
        : await ctx.client.listChatMessages(ctx.sessionId, chat_jid, { limit, offset });

      const messages = q
        ? result.messages.filter((m: MessageHit) => m.chat_jid === chat_jid)
        : result.messages;

      return {
        content: [
          { type: 'text', text: JSON.stringify({ messages, count: messages.length }, null, 2) },
        ],
      };
    },
  );
}
