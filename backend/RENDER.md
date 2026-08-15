# Deploy QuestSave API on Render (Docker)

Keep the client on Orizon. This service is only the Express backend so yt-dlp and ffmpeg are available.

Use the **Starter** plan (~$7/mo). Free instances sleep after idle time and the first request can take 30–60s.

## 1. Create the web service

From the Render dashboard, create a **Web Service** from this repo:

- Language: **Docker**
- Dockerfile path: `backend/Dockerfile`
- Docker build context: `backend`
- Health check path: `/api/health`

Or apply the Blueprint at the repo root (`render.yaml`).

The container already listens on `0.0.0.0` and uses Render's `PORT` env var.

## 2. Environment variables

Copy these from your current Orizon backend into the Render service:

| Key | Example / notes |
| --- | --- |
| `MONGODB_URI` | Same MongoDB URI you use today |
| `JWT_SECRET` | Same secret so existing sessions still work |
| `CLIENT_ORIGIN` | `https://questsave.orzn.app` (the Orizon frontend) |
| `NODE_ENV` | `production` (set by `render.yaml`) |
| `BREVO_API_KEY` | Same as Orizon |
| `MAIL_FROM_NAME` | `QuestSave` |
| `MAIL_FROM_EMAIL` | `noreply@questlabs.cc` |
| `YTDLP_PATH` | `yt-dlp` (set by the image / Blueprint) |
| `YTDLP_IMPERSONATE` | `chrome` (required on Render IPs) |
| `YTDLP_TIMEOUT_MS` | `180000` |
| `YTDLP_COOKIES` | `/etc/secrets/cookies.txt` after you add the secret file (see below) |

Do not set `YTDLP_COOKIES_FROM_BROWSER` on Render — there is no Chrome profile in the container.

## 3. Point the client at Render

In the **Orizon client** project, set:

```
VITE_BASE_URL=https://YOUR-SERVICE.onrender.com
```

Rebuild/redeploy the client. CORS already allows `https://questsave.orzn.app` and whatever you put in `CLIENT_ORIGIN`.

Local development is unchanged: `VITE_BASE_URL=http://localhost:4000`.

## 4. YouTube / Instagram cookies (required on Render)

Render datacenter IPs are often blocked. After yt-dlp is installed you will still see bot-check errors until cookies are present.

1. Create a dedicated Google/Instagram account (not your personal one).
2. In a browser, sign in and export a **Netscape** `cookies.txt` (e.g. the "Get cookies.txt LOCALLY" extension).
3. In Render: **Environment → Secret Files** → add a file named `cookies.txt` and paste the export.
4. Set `YTDLP_COOKIES=/etc/secrets/cookies.txt`.
5. Keep `YTDLP_IMPERSONATE=chrome` (needs `curl_cffi`, already in the image).

Cookies expire every few months. Re-export when YouTube/Instagram start failing again.

Instagram and Facebook often need cookies from a logged-in session in the same file.

## 5. After deploy

- `GET https://YOUR-SERVICE.onrender.com/api/health` should return `{ "ok": true }`.
- TikTok / X can work without cookies. YouTube, Instagram, Facebook, and Pinterest usually need the cookies file.
- Rebuild the image periodically (`pip` install in the Dockerfile) so yt-dlp stays current.

If YouTube still returns a bot-check after cookies + impersonate, the remaining options are a residential proxy or a small VPS whose IP is less burned than shared PaaS ranges.
