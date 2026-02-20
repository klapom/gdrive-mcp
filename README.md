# gdrive-mcp

Google Drive MCP Server for Claude Desktop and Claude Code. Browse, read, search, and manage Google Drive files via natural language.

## Features
- List and search files and folders
- Read file contents (Docs, Sheets, PDFs, plain text)
- Upload, move, copy, and delete files
- OAuth 2.0 authentication flow

## Configuration
Copy `.env.example` to `.env` and fill in your Google OAuth credentials:
- `GOOGLE_CLIENT_ID` — from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console

Run the auth flow on first start: `node dist/auth-cli.js`

## Usage with mcporter
Add to `~/.mcporter/mcporter.json`:
```json
"gdrive": {
  "command": "node --env-file=/path/to/gdrive-mcp/.env /path/to/gdrive-mcp/dist/index.js"
}
```
