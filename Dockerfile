# خادم Math Clash (اللعبة + الواجهة البرمجية + WebSocket) — صورة صغيرة بلا اعتماديات بناء
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/mathclash.db
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
RUN node -e "require('fs').mkdirSync('/data',{recursive:true})"
VOLUME ["/data"]
EXPOSE 8080
USER node
CMD ["node", "--no-warnings", "server/index.js"]
