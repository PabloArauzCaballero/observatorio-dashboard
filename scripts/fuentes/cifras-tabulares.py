# Uso: python scripts/fuentes/cifras-tabulares.py <entrada.woff2> <salida.woff2>
# Libre Franklin no trae `tnum`: sus cifras son proporcionales y `tabular-nums` no hace nada.
# Este parche iguala el avance de 0-9 en todo el eje wght (el de la cifra más ancha en cada
# maestro) y centra cada cifra en su caja, igual que las cifras por defecto de la Franklin Gothic.
import sys
from fontTools.ttLib import TTFont

src, dst = sys.argv[1:3]
f = TTFont(src)
assert [a.axisTag for a in f['fvar'].axes] == ['wght']
cmap = f.getBestCmap()
digits = [cmap[ord(c)] for c in '0123456789']
glyf, hmtx, gvar = f['glyf'], f['hmtx'], f['gvar'].variations

def adv_delta(name, var):
    return var.coordinates[-3][0] - var.coordinates[-4][0]

# Un solo maestro además del de origen: avance(t) = w0 + t·d, lineal en el eje normalizado.
peaks = {tuple(sorted(v.axes.items())) for n in digits for v in gvar.get(n, [])}
assert len(peaks) == 1, peaks
w0 = {n: hmtx[n][0] for n in digits}
d = {}
for n in digits:
    vs = gvar.get(n, [])
    d[n] = adv_delta(n, vs[0]) if vs else 0
W0 = max(w0.values())
W1 = max(w0[n] + d[n] for n in digits)
D = W1 - W0

for n in digits:
    g = glyf[n]
    assert not g.isComposite()
    dx0 = round((W0 - w0[n]) / 2)
    ddx = round((D - d[n]) / 2)
    coords, ends, _ = g.getCoordinates(glyf)
    orig = [tuple(p) for p in coords]
    g.coordinates.translate((dx0, 0))
    g.recalcBounds(glyf)
    hmtx[n] = (W0, g.xMin)
    for v in gvar.get(n, []):
        v.calcInferredDeltas(orig + [(0, 0)] * 4, list(ends))
        c = v.coordinates
        for i in range(len(c) - 4):
            x, y = c[i]
            c[i] = (x + ddx, y)
        c[-4] = (0, 0)
        c[-3] = (D, 0)
    print(f'{n}: {w0[n]}+{d[n]} -> {W0}+{D}  (dx {dx0}+{ddx})')

# HVAR guarda los avances viejos y manda sobre gvar: sin él, el motor los lee de los puntos fantasma.
del f['HVAR']
f.flavor = 'woff2'
f.save(dst)
