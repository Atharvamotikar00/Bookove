FROM node:22-slim

# Calibre provides `ebook-convert`, used to turn uploaded MOBI files into
# EPUB so they can be read in-browser. Comment this out if you don't need
# MOBI support — it's a fairly large dependency.
RUN apt-get update && apt-get install -y --no-install-recommends calibre \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
