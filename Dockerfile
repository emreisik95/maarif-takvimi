FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production
# CapRover varsayılan container portu 80; uygulama 80'i dinlesin
ENV PORT=80
# ÖNEMLİ: süreç saat dilimi UTC olmalı. Tüm takvim mantığı Intl ile açıkça
# Europe/Istanbul kullanır; ancak node-ical/rrule (ICS tekrarları + EXDATE)
# sistem TZ'sine bağlıdır ve yalnızca UTC'de doğru sonuç verir.
ENV TZ=UTC

# Bağımlılıklar (resvg native binary konteyner platformu için kurulur)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Uygulama
COPY . .

EXPOSE 80
CMD ["node", "server.js"]
