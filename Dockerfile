FROM bitnami/node:18

COPY . /app
RUN npm install --omit=dev

USER 1001

EXPOSE 30008
ENTRYPOINT ["/app/bin/session-maker-for-spotify"]
