#!/bin/bash
# Çift tıkla: Haber uygulamasını başlatır ve tarayıcıda açar. Kapatmak için bu pencereyi kapat.
cd "$(dirname "$0")"
PORT=3000
URL="http://localhost:$PORT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js bulunamadı. https://nodejs.org adresinden kurup tekrar dene."
  read -n 1 -s -r -p "Kapatmak için bir tuşa bas..."
  exit 1
fi

# Zaten açıksa sadece tarayıcıda aç
if curl -s -o /dev/null "$URL/api/meta"; then
  open "$URL"
  exit 0
fi

[ -d node_modules ] || { echo "İlk açılış: paketler kuruluyor..."; npm install --silent; }

echo "Haber başlatılıyor... ($URL)"
( for i in {1..30}; do curl -s -o /dev/null "$URL/api/meta" && { open "$URL"; break; }; sleep 0.5; done ) &
PORT=$PORT node src/server.js
