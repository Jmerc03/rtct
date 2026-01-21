FROM node:22-alpine

WORKDIR /app
COPY alert-generator.js ./

RUN npm init -y && npm install node-fetch@2

CMD ["node", "alert-generator.js"]