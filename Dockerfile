# SGB Dashboard — image untuk Coolify (project agency-beriklan)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile 2>/dev/null || (npm i -g pnpm && pnpm install --no-frozen-lockfile)
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4323
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 4323
CMD ["node", "./dist/server/entry.mjs"]
