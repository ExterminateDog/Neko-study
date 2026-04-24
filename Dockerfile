FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

# Set timezone
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npm", "start"]
