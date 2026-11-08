"""Builds ../index.html, the whole app in one file, from the readable sources in this folder.
Run: python3 src/build.py   (from the repo root or from src/)

- template.html: the approved mockup. Only its CSS and its SVG icon set are used.
- extra.css: the app's own styles, added after the mockup's.
  A block between /*@dark*/ and /*@end*/ is written once with ":dark" as the selector; the build
  writes it out twice: for "Automatic" when the device is in dark mode, and for "Dark" picked in Settings.
- app.js, app2.js, app3.js: the app, in that order.
- helper.gs: the short-link reader script shown in Settings. world2.json: the footprint map.
"""
import base64, hashlib, json, os, re
here = os.path.dirname(os.path.abspath(__file__))
read = lambda f: open(os.path.join(here, f), encoding='utf-8').read()

AUTO, PICKED = ':root:not([data-theme="light"])', ':root[data-theme="dark"]'
def expand_dark(css):
    def both(m):
        block = m.group(1).strip('\n')
        return ('@media (prefers-color-scheme: dark) {\n' + block.replace(':dark', AUTO) + '\n}\n'
                + block.replace(':dark', PICKED))
    out = re.sub(r'/\*@dark\*/\n(.*?)\n/\*@end\*/', both, css, flags=re.S)
    assert ':dark' not in out.replace(':dark-', ''), 'a :dark selector outside a /*@dark*/ block'
    return out

tpl = read('template.html')
css = tpl[tpl.index('<style>') + 7:tpl.index('</style>')]
css = '\n'.join(l for l in css.split('\n') if not l.lstrip().startswith('.proto') and not re.match(r'\s*@media \(max-width: (34|26)rem\) \{ \.proto', l))
css = css.replace('/* ===== mockup control, not part of the design ===== */', '')
css = css.replace('/* Polished mockup (Impeccable critique applied)', '/* Milo & Miles. Design from the polished mockup (Impeccable critique applied)')
css += expand_dark(read('extra.css'))

svg = tpl[tpl.index('<svg width="0"'):tpl.index('</svg>\n\n<div id="app">') + 6]
svg = svg.replace('<symbol id="i-plus"', '<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>\n  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>\n  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></symbol>\n  <symbol id="i-plus"')

js = read('app.js') + read('app2.js') + read('app3.js')
js = js.replace('%%HELPER%%', json.dumps(read('helper.gs')).replace('</', '<\\/'))
js = js.replace('%%WORLD2%%', read('world2.json'))

# Content Security Policy: only this file's own script (matched by its hash), Leaflet from cdnjs and
# Google's Maps code may run. Injected HTML can't run script (no inline handlers, no other sources), and
# the page can only talk to the services it uses, so nothing can be sent anywhere else.
script_text = '\n' + js + '\n'  # exactly what sits between <script> and </script> below
script_hash = base64.b64encode(hashlib.sha256(script_text.encode('utf-8')).digest()).decode()
CSP = '; '.join([
    "default-src 'self'",
    # Google's Maps code needs eval and blob workers (see Google's CSP guide for the Maps JavaScript API).
    # This app has no eval of its own, so 'unsafe-eval' adds no way in; inline handlers stay blocked.
    f"script-src 'sha256-{script_hash}' https://cdnjs.cloudflare.com https://*.googleapis.com https://*.gstatic.com 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://cdnjs.cloudflare.com https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.ggpht.com",
    "connect-src 'self' https://api.github.com https://photon.komoot.io https://en.wikipedia.org https://script.google.com https://script.googleusercontent.com https://*.googleapis.com https://*.gstatic.com https://maps.google.com data: blob:",
    "worker-src 'self' blob:",
    "frame-src https://*.google.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
])
page = read('head.html').replace('%%CSP%%', CSP) + css + f'''</style>
</head>
<body>
{svg}

<div class="topguard" aria-hidden="true"></div>
<a class="visually-hidden" href="#main">Skip to the page</a>
<div id="app"></div>
<input type="file" id="importFile" accept=".json,application/json" hidden>
<div class="visually-hidden" role="status" aria-live="polite" id="live"></div>
<script>{script_text}</script>
</body>
</html>
'''
open(os.path.join(here, '..', 'index.html'), 'w', encoding='utf-8').write(page)
print('built index.html,', len(page), 'characters')
