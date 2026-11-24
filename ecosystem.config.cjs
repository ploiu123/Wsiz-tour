// PM2 (menedżer procesów na serwerze): serwer gry działa stale, a po awarii albo restarcie serwera wstaje sam.
// Wdrożenie (scripts/wdrozenie.sh) uruchamia go poleceniem: pm2 startOrReload ecosystem.config.cjs && pm2 save
// Ustawienia serwera gry (port, folder z paczką, klucz uczelni) są w pliku .env obok, nigdy w repozytorium.
module.exports = {
  apps: [
    {
      name: 'wsiz-tour',
      cwd: __dirname,
      script: 'server/index.ts',
      interpreter: 'node',
      node_args: '--experimental-strip-types --no-warnings --env-file-if-exists=.env',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '400M',
      time: true,
    },
  ],
};
