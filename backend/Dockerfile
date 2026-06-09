# FlowOS backend — production container.
# Runs the TypeScript server directly with tsx (the project's rootDir is "./", so a
# tsc build would emit dist/src/server.js, not dist/server.js — tsx avoids that).
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better layer caching). tsx is a devDependency, so we
# install everything (not --omit=dev).
COPY package*.json ./
RUN npm install --no-audit --no-fund

# App source.
COPY . .

ENV NODE_ENV=production
# Hosts (Render/Railway/Fly) inject their own PORT; default to 4000 locally.
ENV PORT=4000
EXPOSE 4000

# env.ts reads PORT/MONGODB_URI/JWT_* from the environment at boot.
CMD ["npx", "tsx", "src/server.ts"]
