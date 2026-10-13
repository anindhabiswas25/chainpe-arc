# Build from the REPO ROOT so the shared Arc constants are in the context:
#   docker build -f services/chainpe-facilitator/Dockerfile -t chainpe-facilitator .
FROM node:20-alpine AS build
WORKDIR /repo
COPY services/chainpe-facilitator/package.json services/chainpe-facilitator/package-lock.json services/chainpe-facilitator/
RUN cd services/chainpe-facilitator && npm ci
COPY packages/chainpe-sdk/src/arc.ts packages/chainpe-sdk/src/arc.ts
COPY services/chainpe-facilitator services/chainpe-facilitator
RUN cd services/chainpe-facilitator && npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/services/chainpe-facilitator/package.json ./
COPY --from=build /repo/services/chainpe-facilitator/node_modules ./node_modules
COPY --from=build /repo/services/chainpe-facilitator/dist ./dist
USER node
EXPOSE 4500
CMD ["node", "dist/server.js"]
