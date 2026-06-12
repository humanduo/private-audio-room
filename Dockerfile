FROM node:20-alpine AS build

WORKDIR /app
ENV NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm install --include=dev --no-audit --no-fund
RUN npm install --no-save typescript vite @vitejs/plugin-react --no-audit --no-fund

COPY . .
RUN npm exec -- tsc -b && npm exec -- vite build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV AUDIO_ROOT=/media/audio

COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules

RUN mkdir -p /app/data /media/audio

EXPOSE 8787

CMD ["npm", "run", "start"]
