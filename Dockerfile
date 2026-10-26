FROM ghcr.io/n8n-io/n8n:latest

ENV NODE_OPTIONS="--max-old-space-size=384"

COPY start.mjs /start.mjs

EXPOSE 5678

ENTRYPOINT ["tini", "--", "node", "/start.mjs"]
