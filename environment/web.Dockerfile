# Contexto de build: la raíz del repo (docker build -f environment/web.Dockerfile .)
FROM node:22-alpine AS build
WORKDIR /web

COPY src/web/package.json src/web/package-lock.json ./
RUN npm ci

COPY src/web/ ./
# Vite fija las VITE_* al compilar: el navegador llamará a esta URL de la API
ARG VITE_USE_MOCKS=false
ARG VITE_API_URL=http://localhost:8000
ARG VITE_ROUTER_MODE=browser
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS VITE_API_URL=$VITE_API_URL VITE_ROUTER_MODE=$VITE_ROUTER_MODE
RUN npm run build

FROM nginx:alpine
COPY environment/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
