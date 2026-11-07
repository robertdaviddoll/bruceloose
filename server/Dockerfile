# Bruce Loose score API: Node's built-in http + SQLite, no npm packages.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/scores.db
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
