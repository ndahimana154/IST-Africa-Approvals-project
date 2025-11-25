# Step 1 — Build the Vite frontend
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=512" npm run build

# Step 2 — Serve with Nginx
FROM nginx:alpine

# Copy built files from Vite's dist/ folder
COPY --from=build /app/dist /usr/share/nginx/html

# COPY NGINX CONFIGURATION - ADD THIS LINE
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]