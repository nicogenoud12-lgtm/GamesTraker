FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# Reintenta descargas si el registro corta la conexión (ECONNRESET) en vez de fallar el build.
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000
COPY . .
ARG VITE_RAWG_KEY=
ENV VITE_RAWG_KEY=$VITE_RAWG_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
