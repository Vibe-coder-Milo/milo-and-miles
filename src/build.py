"""Builds ../index.html, the whole app in one file, from the readable sources in this folder.
Run: python3 src/build.py   (from the repo root or from src/)

- template.html: the approved mockup. Only its CSS and its SVG icon set are used.
- extra.css: the app's own styles, added after the mockup's.
  A block between /*@dark*/ and /*@end*/ is written once with ":dark" as the selector; the build
  writes it out twice: for "Automatic" when the device is in dark mode, and for "Dark" picked in Settings.
- app.js, app2.js, app3.js: the app, in that order.
- helper.gs: the short-link reader script shown in Settings. world2.json: the footprint map.
"""
import json, os, re
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
svg = svg.replace('<symbol id="i-plus"', '<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>\n  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></symbol>\n  <symbol id="i-plus"')

js = read('app.js') + read('app2.js') + read('app3.js')
js = js.replace('%%HELPER%%', json.dumps(read('helper.gs')).replace('</', '<\\/'))
js = js.replace('%%WORLD2%%', read('world2.json'))

page = read('head.html') + css + f'''</style>
</head>
<body>
{svg}

<a class="visually-hidden" href="#main">Skip to the page</a>
<div id="app"></div>
<input type="file" id="importFile" accept=".json,application/json" hidden>
<div class="visually-hidden" role="status" aria-live="polite" id="live"></div>
<script>
{js}
</script>
</body>
</html>
'''
open(os.path.join(here, '..', 'index.html'), 'w', encoding='utf-8').write(page)
print('built index.html,', len(page), 'characters')
