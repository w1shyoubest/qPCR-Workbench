"""Build the qPCR Workbench site into docs/ (served by GitHub Pages).

Usage (from the repo root):  python3 src/build.py

  src/reader/    reader.html + reader.js     -> docs/index.html     (qPCR Reader)
  src/designer/  designer.html + designer.js -> docs/designer.html  (Plate Designer)
  src/shared/    core.js (QuantStudio parsing and analysis) rich.js (text boxes, Word/PDF reports) and plate.js (plate-map drawing), used by both pages
  src/static/    service worker, manifest and icons, copied to docs/ as they are
  src/vendor/    pinned third-party libraries, downloaded from npm once if missing

Each page is a single self-contained HTML file, so it also works when opened straight from disk.
"""
import io, os, shutil, tarfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'src'), os.path.join(ROOT, 'docs')
VENDOR = os.path.join(SRC, 'vendor')
LIBS = {'jszip.min.js': ('jszip', '3.10.1', 'package/dist/jszip.min.js'),
        'xlsx.full.min.js': ('xlsx', '0.18.5', 'package/dist/xlsx.full.min.js'),
        'chart.umd.js': ('chart.js', '4.4.1', 'package/dist/chart.umd.js')}
PARTS = {'/*JSZIP*/': 'vendor/jszip.min.js', '/*XLSX*/': 'vendor/xlsx.full.min.js', '/*CHARTJS*/': 'vendor/chart.umd.js',
         '/*CORE*/': 'shared/core.js', '/*RICH*/': 'shared/rich.js', '/*PLATE*/': 'shared/plate.js', '/*READER*/': 'reader/reader.js', '/*DESIGNER*/': 'designer/designer.js'}
PAGES = [('reader/reader.html', 'index.html'), ('designer/designer.html', 'designer.html')]

os.makedirs(VENDOR, exist_ok=True)
for out, (name, ver, inner) in LIBS.items():
    p = os.path.join(VENDOR, out)
    if not os.path.exists(p):
        url = f'https://registry.npmjs.org/{name}/-/{name.split("/")[-1]}-{ver}.tgz'
        with tarfile.open(fileobj=io.BytesIO(urllib.request.urlopen(url).read())) as t:
            open(p, 'wb').write(t.extractfile(inner).read())

read = lambda rel: open(os.path.join(SRC, rel), encoding='utf-8').read()
safe = lambda s: s.replace('</script', '<\\/script')
os.makedirs(OUT, exist_ok=True)
for tpl, out in PAGES:
    t = read(tpl)
    for k, f in PARTS.items():
        if k in t: t = t.replace(k, safe(read(f)))
    open(os.path.join(OUT, out), 'w', encoding='utf-8').write(t)
    print('docs/' + out)
static = os.path.join(SRC, 'static')
shutil.copytree(static, OUT, dirs_exist_ok=True)
print('docs/ static files: ' + ', '.join(sorted(os.listdir(static))))
