# Build from the REPO ROOT so the shared Arc constants are in the context:
#   docker build -f services/chainpe-indexer/Dockerfile -t chainpe-indexer .
FROM node:20-alpine AS build
WORKDIR /repo
COPY services/chainpe-indexer/package.json services/chainpe-indexer/package-lock.json services/chainpe-indexer/
RUN cd services/chainpe-indexer && npm ci
COPY packages/chainpe-sdk/src/arc.ts packages/chainpe-sdk/src/arc.ts
COPY services/chainpe-indexer services/chainpe-indexer
RUN cd services/chainpe-indexer && npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/services/chainpe-indexer/package.json ./
COPY --from=build /repo/services/chainpe-indexer/node_modules ./node_modules
COPY --from=build /repo/services/chainpe-indexer/dist ./dist
USER node
EXPOSE 4600
CMD ["node", "dist/server.js"]
