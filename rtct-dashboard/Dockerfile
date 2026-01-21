# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:1.27-alpine

RUN printf "server {\n\
  listen 8080;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  # SPA fallback
  location / { try_files \$uri /index.html; }\n\
}\n" > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080