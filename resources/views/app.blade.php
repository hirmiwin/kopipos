<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#7c2d12" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title> Kopi POS — Kasir</title>
    @vite(['resources/js/src/main.tsx', 'resources/js/src/styles.css'])
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
