import json, os, subprocess, urllib.parse

OUT = os.path.expanduser('~/workspace/ww2-asia/assets/ui/flags')
os.makedirs(OUT, exist_ok=True)

# faction -> (candidate Commons file titles in order, search keyword fallback)
FLAGS = {
    'roc':        (['Flag of the Republic of China.svg'], 'Republic of China flag'),
    'ccp':        (['Flag of the Chinese Communist Party.svg'], 'Chinese Communist Party flag'),
    'warlords':   (['Flag of the Republic of China (1912-1928).svg', 'Flag of the Republic of China (1912).svg'], 'five races under one union flag'),
    'japan':      (['Flag of Japan (1870-1999).svg', 'Flag of Japan.svg'], 'Japan flag 1870'),
    'manchukuo':  (['Flag of Manchukuo.svg'], 'Manchukuo flag'),
    'wang':       (['Flag of the Republic of China-Nanjing (1940-1945).svg'], 'Wang Jingwei regime flag Nanjing'),
    'mengjiang':  (['Flag of Mengjiang.svg'], 'Mengjiang flag'),
    'thailand':   (['Flag of Thailand.svg'], 'Thailand flag'),
    'usa':        (['Flag of the United States (1912-1959).svg'], 'United States flag 48 stars'),
    'uk':         (['Flag of the United Kingdom (1-2).svg', 'Flag of the United Kingdom.svg'], 'United Kingdom flag'),
    'netherlands':(['Flag of the Netherlands.svg'], 'Netherlands flag'),
    'france':     (['Flag of France.svg'], 'France flag'),
    'ussr':       (['Flag of the Soviet Union (1936-1955).svg', 'Flag of the Soviet Union.svg'], 'Soviet Union flag 1936'),
    'mongolia':   (['Flag of the Mongolian People\'s Republic (1940-1992).svg'], 'Mongolian People Republic flag 1940'),
    'vietminh':   (['Flag of North Vietnam (1945-1955).svg', 'Flag of Vietnam.svg'], 'North Vietnam flag 1945'),
    'burma':      (['Flag of the State of Burma (1943-1945).svg'], 'State of Burma flag 1943'),
    'ina':        (['Flag of Azad Hind.svg'], 'Azad Hind flag'),
    'philippines':(['Flag of the Philippines.svg'], 'Philippines flag'),
    'tibet':      (['Flag of Tibet.svg'], 'Tibet flag'),
}

def fetch_png(title, dest):
    url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(title) + '?width=640'
    r = subprocess.run(['curl', '-4', '-sL', '--max-time', '60', '-o', dest, '-w', '%{http_code}', url],
                       capture_output=True, text=True)
    if r.stdout.strip() != '200':
        return False
    with open(dest, 'rb') as f:
        magic = f.read(8)
    return magic.startswith(b'\x89PNG')

def search_flag(keyword):
    api = ('https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&format=json&srlimit=8&srsearch='
           + urllib.parse.quote(keyword + ' flag'))
    r = subprocess.run(['curl', '-4', '-sL', '--max-time', '60', api], capture_output=True, text=True)
    try:
        data = json.loads(r.stdout)
        return [it['title'][5:] for it in data['query']['search'] if it['title'].lower().endswith('.svg')]
    except Exception:
        return []

results = {}
for key, (cands, kw) in FLAGS.items():
    dest = os.path.join(OUT, 'flag_%s.png' % key)
    got = None
    for t in cands:
        if fetch_png(t, dest):
            got = t
            break
    if not got:
        for t in search_flag(kw):
            if fetch_png(t, dest):
                got = t + ' (via search)'
                break
    results[key] = got
    print(key, '->', got)

print(json.dumps(results, ensure_ascii=False, indent=1))
