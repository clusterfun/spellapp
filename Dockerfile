# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN npm install

COPY . .

# We no longer pass VITE_API_KEY to the frontend build
RUN npm run build

# Stage 2: Serve with Node.js Express server
FROM node:20-alpine

WORKDIR /app

# Copy built assets from Stage 1
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./

# Install production dependencies for the server
RUN npm install --omit=dev

# The API_KEY should be provided at RUNTIME as an environment variable
# Cloud Run handles this via its configuration/secrets
ENV PORT=8080
EXPOSE 8080

# Use npm start to handle signals and start the server
CMD ["npm", "start"]
