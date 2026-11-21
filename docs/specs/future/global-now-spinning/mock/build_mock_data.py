"""Build data.json + p/ (photos) for the Now Spinning mock from the repo's public/data.

Usage (from repo root):  python3 docs/specs/future/global-now-spinning/mock/build_mock_data.py
Then serve the mock folder:  python3 -m http.server -d docs/specs/future/global-now-spinning/mock 8765
"""
import json, os, re, sys
from PIL import Image  # pip install pillow

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(ROOT, 'public/data/')
L = lambda f: json.load(open(R + f))
norm = lambda s: re.sub(r'^-|-$', '', re.sub(r'-+', '-', re.sub(r'[^a-z0-9]', '-', s.lower())))
# must match loose() in index.html: drop a leading "the" and every "and" ("&" already slugs away)
loose = lambda s: re.sub(r'(^|-)and(?=-|$)', '', re.sub(r'^the-', '', norm(s))).replace('-', '')

am, conc = L('artists-metadata.json'), L('concerts.json')['concerts']
media, al = L('media-index.json')['assets'], L('artist-aliases.json')
sc = L('setlists-cache.json')['entries']
sa, cov = L('song-albums.json')['songs'], L('album-covers.json')['covers']

artists = {}
def add(slug, name, c, role):
    x = artists.setdefault(slug, {'n': name, 'i': (am.get(slug) or {}).get('image'), 's': []})
    x['s'].append([c['date'], c['venue'], c['cityState'], role])
for c in conc:
    add(c['headlinerNormalized'], c['headliner'], c, 'h')
    for o in c['openers']: add(norm(o), o, c, 'o')
for x in artists.values(): x['s'].sort()

canon = {b: g['canonical'] for g in al.get('sameAct', []) for b in g['billings']}
cn = lambda a: canon.get(a, a)

# Songs from EVERY setlist (headliners and openers). song-index.json only has headliners.
songs, albums, aidx, has_setlist, covers = {}, [], {}, set(), {}
for e in sc:
    a = norm(e['artistName'])
    for st in ((e.get('setlist') or {}).get('sets', {}).get('set') or []):
        for s in st.get('song', []):
            n = (s.get('name') or '').strip()
            if not n or s.get('tape'): continue
            has_setlist.add(e['date'] + '|' + a)
            songs.setdefault(a + '::' + norm(n), {'n': n, 'a': a, 'd': set()})['d'].add(e['date'])
            c = s.get('cover')
            if c and cn(norm(c['name'])) != cn(a):
                row = [n, a, e['date']]
                lst = covers.setdefault(loose(c['name']), [])
                if row not in lst: lst.append(row)
out_songs = []
for k, x in songs.items():
    al_i, m = None, sa.get(k)
    if m and m.get('albumTitle'):
        if m['mbid'] not in aidx:
            c = cov.get(m['mbid'])
            c = c.replace('100x100bb', '600x600bb') if c else (
                f"https://coverartarchive.org/release-group/{m['mbid']}/front-500.jpg" if m.get('coverAvailable') else None)
            aidx[m['mbid']] = len(albums)
            albums.append({'t': m['albumTitle'], 'y': (m.get('releaseDate') or '')[:4], 'c': c})
        al_i = aidx[m['mbid']]
    out_songs.append({'n': x['n'], 'a': x['a'], 'd': sorted(x['d']), 'al': al_i})

# Photos: up to 3 per night, resized into ./p
os.makedirs(os.path.join(OUT, 'p'), exist_ok=True)
photos = {}
for m in media:
    if m.get('subject') != 'artist' or m['kind'] != 'image': continue
    key = m['date'] + '|' + m['artistNormalized']
    if len(photos.get(key, [])) >= 3: continue
    src = os.path.join(ROOT, 'public', m['url'].lstrip('/'))
    if not os.path.exists(src): continue
    fn = os.path.basename(src); im = Image.open(src).convert('RGB'); im.thumbnail((1280, 1280))
    im.save(os.path.join(OUT, 'p', fn), quality=72, optimize=True, progressive=True)
    photos.setdefault(key, []).append('p/' + fn)

data = {'albums': albums, 'songs': out_songs, 'artists': artists, 'canon': canon,
        'photos': photos, 'sl': sorted(has_setlist), 'cv': covers}
json.dump(data, open(os.path.join(OUT, 'data.json'), 'w'), separators=(',', ':'))
print(f"{len(out_songs)} songs, {len(albums)} albums, {len(artists)} artists, "
      f"{sum(map(len, photos.values()))} photos, {len(covers)} covered artists")
