FROM docker.n8n.io/n8nio/n8n:latest

USER root

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node

EXPOSE 5678

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
