# Wdrożenie gry na serwer WWW

## Paczka

```bash
npm install        # raz
npm run build      # paczka w folderze dist/
```

`dist/` zawiera wszystko, czego potrzebuje gra: `index.html`, kod i style w `app/` (nazwy z hashem, więc można je długo trzymać w cache), czcionki, logo, muzykę, pytania, wersję kart do druku i stronę-wizytówkę (`prezentacja-strona/`). Folder można wgrać do dowolnego miejsca na serwerze, także do podfolderu (np. `https://uczelnia.pl/gra/`), bo wszystkie ścieżki są względne.

Utwory z Uppbeat (`gra.mp3`, `gra-2.mp3`) nie trafiają do paczki, bo ich licencja nie pozwala udostępniać plików publicznie. Na serwerze gra i menu grają muzykę generowaną w kodzie, a prezentacja utwór na licencji CC BY 3.0 z podpisem autora.

## Kompresja i cache

Obok plików `.js`, `.css` i `.html` są gotowe wersje `.br` (Brotli) i `.gz` (gzip). Serwer powinien wysyłać je zamiast zwykłych plików, gdy przeglądarka je obsługuje.

### Nginx

```nginx
location /gra/ {
    alias /var/www/wsiz-tour/;          # zawartość folderu dist/
    brotli_static on;                   # moduł ngx_brotli; bez niego zostaw tylko gzip_static
    gzip_static on;
    try_files $uri $uri/ /gra/index.html;

    location ~* /app/ {                 # pliki z hashem w nazwie nigdy się nie zmieniają
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location = /gra/index.html {
        add_header Cache-Control "no-cache";
    }
}
types { font/woff2 woff2; }
```

### Apache (`.htaccess` w folderze gry)

```apache
Options -MultiViews
AddType font/woff2 .woff2
RewriteEngine On
RewriteCond %{HTTP:Accept-Encoding} br
RewriteCond %{REQUEST_FILENAME}.br -f
RewriteRule ^(.+)\.(js|css|html)$ $1.$2.br [L]
RewriteCond %{HTTP:Accept-Encoding} gzip
RewriteCond %{REQUEST_FILENAME}.gz -f
RewriteRule ^(.+)\.(js|css|html)$ $1.$2.gz [L]
<FilesMatch "\.js\.(br|gz)$">ForceType application/javascript</FilesMatch>
<FilesMatch "\.css\.(br|gz)$">ForceType text/css</FilesMatch>
<FilesMatch "\.html\.(br|gz)$">ForceType text/html</FilesMatch>
<FilesMatch "\.br$">Header set Content-Encoding br</FilesMatch>
<FilesMatch "\.gz$">Header set Content-Encoding gzip</FilesMatch>
<If "%{REQUEST_URI} =~ m#/app/#">Header set Cache-Control "public, max-age=31536000, immutable"</If>
```

## Sprawdzenie przed wysłaniem

```bash
npm run check      # lint, typy, testy i paczka
npm run e2e        # testy w przeglądarce (pierwszy raz: npx playwright install chromium)
npm run preview    # paczka z dist/ pod adresem http://localhost:4173
```

## Serwer gry wieloosobowej

Tryb online będzie miał osobny serwer Node.js (etap 3 planu w `docs/plan-techniczny.md`). Klucz aplikacji od uczelni będzie tylko w pliku `.env` na tym serwerze, nigdy w paczce `dist/`.
