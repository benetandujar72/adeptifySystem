# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

ARG GEMINI_API_KEY
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG SB_PUBLISHABLE_KEY

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV GEMINI_API_KEY=$GEMINI_API_KEY \
	SUPABASE_URL=$SUPABASE_URL \
	SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
	SB_PUBLISHABLE_KEY=$SB_PUBLISHABLE_KEY

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN apk update && apk upgrade --no-cache
USER nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
