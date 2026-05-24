FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8081
EXPOSE 19000
EXPOSE 19001
EXPOSE 19006

CMD ["npx", "expo", "start", "--port", "8081", "--host", "lan"]
