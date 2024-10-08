# Use an official Node runtime as the base image, explicitly x86_64
FROM --platform=linux/amd64 node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json, yarn.lock, and tsconfig files
COPY package.json yarn.lock tsconfig.json tsconfig.dev.json ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN yarn build

# Production image, copy all the files and run next
FROM --platform=linux/amd64 node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]