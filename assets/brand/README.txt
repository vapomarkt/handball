# ThrowOff (throwoff.app) — Icon & Brand Asset Pack

## Farbpalette
- Arena Slate (Primär / Hintergrund): #111820  (RGB: 17, 24, 32)
- Court Orange (Akzent / Spieler):    #E85422  (RGB: 232, 84, 34)
- Tape Chalk (Linien / Hell):         #F4F3EE  (RGB: 244, 243, 238)
- Resin Amber (Sekundär / Badges):    #C89236  (RGB: 200, 146, 54)

## Empfohlene Schriften
- Headlines / Logo: Barlow Condensed (Bold / ExtraBold) oder Space Grotesk
- Zahlen / Timer / Stats: JetBrains Mono (mit Tabular Figures)
- Fließtext / UI: Plus Jakarta Sans oder Inter

## Ordnerstruktur
- ios/AppIcon.appiconset/  -> Direkt in Xcode (Assets.xcassets) kopieren
- android/                 -> mipmap-Ordner + Adaptive Icon Layer (432x432 Safe Zone) + Play Store 512x512
- web/                     -> Favicons, apple-touch-icon, PWA-Icons & site.webmanifest
- social-media/            -> Avatare (Dark/Light), OG-Image (1200x630), X/Twitter, LinkedIn, YouTube & Google Play Feature Graphic
- brand/                   -> Hochauflösende Master-Dateien inkl. transparenter & monochromer Versionen

## HTML <head> Snippet für throwoff.app
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111820">
<meta property="og:title" content="ThrowOff">
<meta property="og:image" content="https://throwoff.app/og-image-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
