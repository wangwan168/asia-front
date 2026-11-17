import json, os, subprocess, sys, time, urllib.parse

OUT = os.path.expanduser('~/workspace/ww2-asia/assets/ui/flags')
LOG = os.path.expanduser('~/workspace/ww2-asia/assets/ui/flags_retry.log')

FLAGS = {
    'roc':        ['Flag of the Republic of China.svg'],
    'ccp':        ['Flag of the Chinese Communist Party.svg'],
    'warlords':   ['Flag of the Republic of China (1912-1928).svg'],
    'japan':      ['Flag of Japan (1870-1999).svg', 'Flag of Japan.svg'],
    'manchukuo':  ['Flag of Manchukuo.svg'],
    'mengjiang':  ['Flag of Mengjiang.svg'],
    'thailand':   ['Flag of Thailand.svg'],
    'usa':        ['Flag of the United States (1912-1959).svg'],
    'uk':         ['Flag of the United Kingdom (1-2).svg', 'Flag of the United Kingdom.svg'],
    'netherlands':['Flag of the Netherlands.svg'],
    'france':     ['Flag of France.svg'],
    'ussr':       ['Flag of the Soviet Union (1936-1955).svg', 'Flag of the Soviet Union.svg'],
    'mongolia':   ["Flag of the Mongolian People's Republic (1940-1992).svg"],
    'vietminh':   ['Flag of North Vietnam (1945-1955).svg', 'Flag of Vietnam.svg'],
    'burma':      ['Flag of the State of Burma (1943-1945).svg'],
    'ina':        ['Flag of Azad Hind.svg'],
    'philippines':['Flag of the Philippines.svg'],
    'tibet':      ['Flag of Tibet.svg'],
}

def ok_png(path):
    try:
        with open(path, 'rb') as f:
            return f.read(8).startswith(b'\x89PNG') and os.path.getsize(path) > 3000
    except Exception:
        return False

def fetch(title, dest):
    url = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(title) + '?width=640'
    subprocess.run(['curl', '-4', '-sL', '--retry', '3', '--retry-all-errors', '--max-time', '90',
                    '-o', dest, url], capture_output=True)
    return ok_png(dest)

with open(LOG, 'a') as log:
    for rnd in range(8):
        missing = [k for k in FLAGS if not ok_png(os.path.join(OUT, 'flag_%s.png' % k))]
        if not missing:
            log.write('ALL DONE round %d\n' % rnd)
            break
        log.write('round %d missing: %s\n' % (rnd, ','.join(missing)))
        log.flush()
        for k in missing:
            dest = os.path.join(OUT, 'flag_%s.png' % k)
            for t in FLAGS[k]:
                if fetch(t, dest):
                    log.write('got %s from %s\n' % (k, t))
                    log.flush()
                    break
            time.sleep(1)
    log.write('FINISHED\n')
print('retry script done')
