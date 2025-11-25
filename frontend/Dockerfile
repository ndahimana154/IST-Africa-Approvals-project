# Step 1 — Build the Vite frontend
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# Use npm ci for cleaner, more reliable installs in CI environments
RUN npm ci --silent

COPY . .
# Set memory limit appropriate for 512MB system with swap
RUN NODE_OPTIONS="--max-old-space-size=512" npm run build

# Step 2 — Serve with Nginx
FROM nginx:alpine

# Copy built files from Vite's dist/ folder
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config (optional but recommended)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]