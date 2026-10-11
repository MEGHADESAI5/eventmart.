# Build context is the repository root (see docker-compose.yml) so ./proto is reachable.
FROM node:20-alpine AS build
WORKDIR /app
COPY services/order-service/package*.json ./
RUN npm ci
COPY services/order-service/tsconfig.json ./
COPY services/order-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PROTO_PATH=/app/proto/inventory.proto
COPY services/order-service/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY proto ./proto
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
