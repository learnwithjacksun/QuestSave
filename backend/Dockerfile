FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Deno runs YouTube's n-challenge JS for yt-dlp
ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh

# pip (not the GitHub binary) so yt-dlp ships EJS solver files
RUN pip3 install --no-cache-dir --break-system-packages -U \
    "yt-dlp[default]" \
    "curl_cffi>=0.10,<0.13"

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV YTDLP_PATH=yt-dlp
ENV YTDLP_IMPERSONATE=chrome

EXPOSE 4000

CMD ["node", "src/index.js"]
