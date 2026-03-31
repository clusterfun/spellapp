# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve the app with a web server
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy the nginx config template
COPY nginx.template.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

