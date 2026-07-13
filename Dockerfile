FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
