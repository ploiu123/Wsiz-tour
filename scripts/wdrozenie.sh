#!/usr/bin/env bash
# Wdrożenie WSiZ Tour na serwer przez SSH (rsync). Uruchamia je GitHub Actions (.github/workflows/wdrozenie.yml)
# po zielonych testach na gałęzi main. Można je też uruchomić ręcznie z komputera z dostępem do serwera.
# Instrukcja krok po kroku: docs/github-wdrozenie.md.
#
# Ustawienia (zmienne środowiskowe):
#   DEPLOY_HOST              adres serwera (wymagany)
#   DEPLOY_USER              użytkownik SSH na serwerze (wymagany)
#   DEPLOY_PATH              folder gry na serwerze, np. /var/www/wsiz-tour (wymagany)
#   DEPLOY_PORT              port SSH (domyślnie 22)
#   DEPLOY_MODE              server (domyślnie): projekt z paczką dist/ i serwer gry Node.js (tryb online),
#                            serwer gry uruchamia się od nowa;
#                            static: tylko pliki gry z dist/ dla zwykłego serwera WWW (bez trybu online)
#   DEPLOY_RESTART           własne polecenie uruchomienia serwera gry (np. sudo systemctl restart wsiz-tour),
#                            domyślnie PM2 z pliku ecosystem.config.cjs
#   DEPLOY_URL               adres gry do sprawdzenia po wdrożeniu (opcjonalnie)
#   DEPLOY_KEY_FILE          plik z kluczem prywatnym SSH (opcjonalnie; w GitHub Actions ustawia go workflow)
#   DEPLOY_KNOWN_HOSTS_FILE  plik z odciskiem serwera (opcjonalnie; wtedy połączenie tylko z tym serwerem)
#
# Paczka dist/ musi być zbudowana wcześniej (npm run build).
# Na serwerze zostają nietknięte: plik .env (klucz uczelni i ustawienia), node_modules/ i wszystko z listy
# scripts/wdrozenie-pomin.txt, a w trybie static także .htaccess.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DEPLOY_HOST:?Brak DEPLOY_HOST (adres serwera)}"
: "${DEPLOY_USER:?Brak DEPLOY_USER (użytkownik SSH)}"
: "${DEPLOY_PATH:?Brak DEPLOY_PATH (folder gry na serwerze)}"
PORT="${DEPLOY_PORT:-22}"
MODE="${DEPLOY_MODE:-server}"
case "$MODE" in server|static) ;; *) echo "DEPLOY_MODE ma być server albo static, a jest: $MODE" >&2; exit 1 ;; esac
[ -f dist/index.html ] || { echo "Brak paczki dist/ (najpierw npm run build)" >&2; exit 1; }

SSH=(ssh -p "$PORT" -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15)
if [ -n "${DEPLOY_KEY_FILE:-}" ]; then SSH+=(-i "$DEPLOY_KEY_FILE" -o IdentitiesOnly=yes); fi
if [ -n "${DEPLOY_KNOWN_HOSTS_FILE:-}" ]; then SSH+=(-o "UserKnownHostsFile=$DEPLOY_KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes); fi
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
q() { printf '%q' "$1"; }   # bezpieczne cytowanie ścieżki w poleceniu na serwerze

echo "Wdrożenie ($MODE) na $TARGET:$DEPLOY_PATH"
"${SSH[@]}" "$TARGET" "mkdir -p $(q "$DEPLOY_PATH")"
if [ "$MODE" = static ]; then
  rsync -rlptz --delete --exclude=.htaccess --exclude=.well-known/ -e "${SSH[*]}" dist/ "$TARGET:$DEPLOY_PATH/"
else
  rsync -rlptz --delete --include=.env.example --exclude-from=scripts/wdrozenie-pomin.txt -e "${SSH[*]}" ./ "$TARGET:$DEPLOY_PATH/"
  RESTART="${DEPLOY_RESTART:-pm2 startOrReload ecosystem.config.cjs && pm2 save}"
  # powłoka logowania: na serwerze ładuje PATH z Node.js (także zainstalowanym przez nvm)
  "${SSH[@]}" "$TARGET" "bash -lc $(q "cd $(q "$DEPLOY_PATH") && npm ci --omit=dev --no-audit --no-fund && $RESTART")"
fi

if [ -n "${DEPLOY_URL:-}" ]; then
  curl -fsS --retry 6 --retry-delay 5 --retry-all-errors -o /dev/null "$DEPLOY_URL"
  echo "Gra odpowiada pod adresem $DEPLOY_URL"
fi
echo "Gotowe: wdrożono na $TARGET:$DEPLOY_PATH"
