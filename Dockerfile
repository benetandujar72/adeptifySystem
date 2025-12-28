# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN apk update && apk upgrade --no-cache
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

COPY docker-entrypoint.sh /docker-entrypoint.sh

# Allow the unprivileged nginx user to write env.js at container start.
RUN chown -R nginx:nginx /usr/share/nginx/html \
	&& chmod +x /docker-entrypoint.sh

USER nginx

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
