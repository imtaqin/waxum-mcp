import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const DOCS_INDEX_URL = 'https://waxum.imtaqin.id/llms.txt';
const DOCS_FULL_URL = 'https://waxum.imtaqin.id/llms-full.txt';
const PAGE_MARKER = /\n---\n\n# Source: (\/docs\/\S+\.md)\n/g;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetching ${url}: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Splits llms-full.txt's `# Source: /docs/...` concatenation into
 * {path, heading, body} sections so a topic lookup can return just the
 * matching page(s) instead of the whole multi-hundred-KB dump.
 */
function splitPages(fullText: string): Array<{ path: string; body: string }> {
  const markers = [...fullText.matchAll(PAGE_MARKER)];
  const pages: Array<{ path: string; body: string }> = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index! + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : fullText.length;
    pages.push({ path: markers[i][1], body: fullText.slice(start, end).trim() });
  }
  return pages;
}

export function registerGetDocs(server: McpServer): void {
  server.tool(
    'get_docs',
    'Fetch waxum\'s live API documentation. Call this BEFORE using an unfamiliar tool or ' +
      'guessing at request shapes, enum values, or behavior you are not certain of — it is ' +
      'faster and more reliable than assuming. With no `topic`, returns the doc site\'s index ' +
      '(every page and a one-line summary of what it covers) so you can pick a topic. With a ' +
      '`topic` (e.g. "groups", "webhooks", "contacts", "messages", "save_contact", "chat_phone", ' +
      '"newsletters", "labels", "mex") it fetches the full content of every matching page: field ' +
      'names, required/optional-ness, enum values, error shapes, and behavioral notes the JSON ' +
      'schema alone does not carry. Matching is a case-insensitive substring match against the ' +
      'page\'s file path and heading, so a loose or partial topic still finds the right page.',
    {
      topic: z
        .string()
        .optional()
        .describe(
          'What to look up, e.g. "groups", "webhooks", "save contact", "poll". Omit to get the full page index instead.',
        ),
    },
    async ({ topic }) => {
      if (!topic) {
        const index = await fetchText(DOCS_INDEX_URL);
        return { content: [{ type: 'text', text: index }] };
      }

      const full = await fetchText(DOCS_FULL_URL);
      const pages = splitPages(full);
      const needle = topic.toLowerCase();
      const matches = pages.filter((p) => {
        const heading = p.body.split('\n', 1)[0]?.toLowerCase() ?? '';
        return p.path.toLowerCase().includes(needle) || heading.includes(needle);
      });

      if (matches.length === 0) {
        const index = await fetchText(DOCS_INDEX_URL);
        return {
          content: [
            {
              type: 'text',
              text: `No doc page matched "${topic}". Here is the full page index instead — pick a topic from it and call get_docs again:\n\n${index}`,
            },
          ],
        };
      }

      const text = matches.map((p) => `# Source: ${p.path}\n\n${p.body}`).join('\n\n---\n\n');
      return { content: [{ type: 'text', text }] };
    },
  );
}
