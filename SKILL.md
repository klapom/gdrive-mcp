# gdrive-mcp

MCP-Server für Google Drive + Google Docs via OAuth2. 10 Tools zum Listen, Suchen, Lesen, Anlegen, Kopieren, Verschieben, Teilen und Löschen von Dateien/Dokumenten.

## Endpoints

| Surface | URL | Auth |
|---|---|---|
| REST | `http://<host>:32370` | LAN / CF-Access-Token `gdrive-token` |
| MCP Streamable-HTTP | `http://<host>:33370/mcp` | LAN / CF-Access-Token `gdrive-token` |
| MCP stdio | `node --env-file=.env dist/index.js` | — (lokaler Prozess für Claude Desktop) |

Pfad-Konvention: `/mcp` ohne trailing slash (Node-SDK).
Public hostnames (CF-Tunnel): `api-gdrive.pommerconsulting.de` / `mcp-gdrive.pommerconsulting.de`.

## Tools

| Name | Zweck |
|---|---|
| `list_files` | Files in Folder listen (Filter: all/folders/documents/sheets/files) |
| `get_file_info` | Metadaten zu einer File-ID |
| `search_files` | Volltext-/Name-Suche in Drive |
| `read_file` | Text/Google-Doc/Sheet als Plain-Text oder CSV lesen |
| `create_document` | Neues Google-Doc mit Inhalt anlegen |
| `copy_file` | Datei kopieren (optional in anderen Folder) |
| `move_file` | Datei verschieben |
| `update_file` | Text-Inhalt ersetzen oder Name ändern |
| `share_file` | Datei teilen (Email + Rolle) |
| `delete_file` | Datei in Papierkorb oder permanent löschen |

## Auth-Setup

Einmalig OAuth2-Flow durchlaufen:

```bash
# .env mit GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (Google Cloud Console, OAuth-Client-Typ Desktop)
pnpm auth
# URL im Browser öffnen, Zustimmen, Token landet in ~/.gdrive-mcp/token.json
```

Token auto-refresh durch `googleapis` — bei Expiry wird neuer access_token geholt, refresh_token persistiert.

## Env

| Variable | Default | Pflicht |
|---|---|---|
| `GOOGLE_CLIENT_ID` | — | ✅ |
| `GOOGLE_CLIENT_SECRET` | — | ✅ |
| `GOOGLE_TOKEN_PATH` | `~/.gdrive-mcp/token.json` | |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3456/callback` | |
| `LISTEN_PORT` | 32370 | |
| `MCP_PORT` | 33370 | |
| `LISTEN_HOST` | 0.0.0.0 | |
| `LOG_LEVEL` | info | |

## Beispiel-Calls (REST)

```bash
# oberste 10 Files in My Drive
curl -fsS -X POST http://localhost:32370/tools/list_files \
  -H 'content-type: application/json' -d '{"limit":10}'

# Doc-Inhalt lesen
curl -fsS -X POST http://localhost:32370/tools/read_file \
  -H 'content-type: application/json' -d '{"file_id":"1abc..."}'
```
