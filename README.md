# waxum-mcp

MCP server for WhatsApp, backed by the [waxum](https://github.com/imtaqin/waxum)
REST API gateway. Exposes send/read/media tools to any MCP client
(Claude Desktop, Claude Code, etc.) over stdio.

Requires waxum `>= 0.11.5` (needs `GET /messages/chat/{chat_jid}`).

Session pairing (QR / phone-number linking) is **not** part of this
server — pair the session directly against waxum first (its own
console or `POST /sessions/{id}/pair`), then point this server at
that already-paired session.

## Tools

| Tool | Does |
|---|---|
| `send_message` | Send a text message |
| `send_file` | Send a local file (image/video/audio/document/sticker), kind auto-detected from mimetype |
| `get_messages` | Read a chat's recent history, or search it by keyword — includes sender push_name and media pointers |
| `download_media` | Download a message's media to local disk, returns the file path |
| `list_groups` | List groups this session is in, with JIDs and members |
| `list_chats` | List/search known contacts by name, phone, or push_name |
| `session_status` | Check connection/login status |
| `get_docs` | Fetch waxum's live API docs (index, or a topic's full page) — look this up before guessing at a request shape or enum value |

## Configuration

Two ways to point this server at waxum, chosen by `WAXUM_MODE` (or
auto-detected: `client` if `WAXUM_BASE_URL` is set, else `spawn`).

### Client mode — waxum already running elsewhere

```bash
WAXUM_MODE=client
WAXUM_BASE_URL=http://localhost:3451
WAXUM_TOKEN=<superadmin token or a session token>
WAXUM_SESSION_ID=<the session to operate on>
WAXUM_MEDIA_DIR=./media   # optional, default ./media
```

### Spawn mode — this server manages the waxum process

```bash
WAXUM_MODE=spawn
WAXUM_BINARY_PATH=/path/to/waxum
WAXUM_WORKDIR=/path/to/waxum/data   # optional, default: binary's directory
WAXUM_PORT=3451                     # optional, default 3451
WAXUM_TOKEN=<superadmin token>      # optional, a random one is generated if unset
WAXUM_SESSION_ID=<the session to operate on>
WAXUM_DATABASE_URL=sqlite:///data/waxum.db # optional
```

In spawn mode the token becomes the spawned process's
`SUPERADMIN_TOKEN` env var — waxum's own bootstrap credential — so no
token needs to be minted ahead of time. The child process's stdout
and stderr are forwarded to this server's stderr (never stdout, which
is reserved for the MCP protocol channel).

Spawn mode uses SQLite by default at `<WAXUM_WORKDIR>/waxum.db`, keeping
the MCP server zero-config and restart-safe. Set `WAXUM_DATABASE_URL` to
an explicit `sqlite://` path, PostgreSQL URL, or MySQL URL when needed.

## Development

```bash
npm install
npm run dev     # run directly with tsx
npm run build   # compile to dist/
npm start       # run the compiled build
```
