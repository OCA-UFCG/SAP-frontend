FROM node:20.12.2

WORKDIR /app

COPY package*.json ./

RUN npm install

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]