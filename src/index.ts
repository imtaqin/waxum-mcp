#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ChildProcess } from 'node:child_process';

import { loadConfig } from './config.js';
import { spawnWaxum } from './waxumProcess.js';
import { WaxumClient } from './waxumClient.js';
import type { Ctx } from './context.js';
import { registerSendMessage } from './tools/sendMessage.js';
import { registerSendFile } from './tools/sendFile.js';
import { registerGetMessages } from './tools/getMessages.js';
import { registerDownloadMedia } from './tools/downloadMedia.js';
import { registerListGroups } from './tools/listGroups.js';
import { registerListChats } from './tools/listChats.js';
import { registerSessionStatus } from './tools/sessionStatus.js';
import { registerGetDocs } from './tools/getDocs.js';

async function main() {
  const config = loadConfig();

  let child: ChildProcess | undefined;
  let baseUrl: string;
  let token: string;

  if (config.mode === 'spawn') {
    const spawnConfig = config.spawn!;
    child = await spawnWaxum(spawnConfig);
    baseUrl = `http://127.0.0.1:${spawnConfig.port}`;
    token = spawnConfig.token;
  } else {
    baseUrl = config.client!.baseUrl;
    token = config.client!.token;
  }

  const client = new WaxumClient(baseUrl, token);
  const ctx: Ctx = { client, sessionId: config.sessionId, mediaDir: config.mediaDir };

  const server = new McpServer({ name: 'waxum-mcp', version: '0.2.0' });
  registerSendMessage(server, ctx);
  registerSendFile(server, ctx);
  registerGetMessages(server, ctx);
  registerDownloadMedia(server, ctx);
  registerListGroups(server, ctx);
  registerListChats(server, ctx);
  registerSessionStatus(server, ctx);
  registerGetDocs(server);

  const shutdown = () => {
    child?.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[waxum-mcp] ready (mode=${config.mode}, session=${config.sessionId})\n`);
}

main().catch((err) => {
  process.stderr.write(`[waxum-mcp] fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
