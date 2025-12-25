# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_GEMINI_API_KEY
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SB_PUBLISHABLE_KEY

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY \
	VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
	VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
	VITE_SB_PUBLISHABLE_KEY=$VITE_SB_PUBLISHABLE_KEY

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN apk update && apk upgrade --no-cache
USER nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
