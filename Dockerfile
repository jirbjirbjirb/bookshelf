FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 ships prebuilt binaries but has a binding.gyp and no install script,
# so npm would run node-gyp rebuild (no Python/compiler in this image). Skip it.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DB_FILE=/data/app.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
