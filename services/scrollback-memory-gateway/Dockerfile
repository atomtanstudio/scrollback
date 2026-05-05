FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --package-lock=false

COPY server.mjs ./

USER node
EXPOSE 8787

CMD ["node", "server.mjs"]
