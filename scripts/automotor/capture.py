"""Archive public evidence and write hashes. Requires requests, beautifulsoup4.

Run from repository root: python scripts/automotor/capture.py
Raw responses stay outside git in output/automotor; the manifest is versioned.
No form submission, credential or private quotation is used.
"""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "ine-fleet": ("INE · Parque automotor 2025", "https://nimbus.ine.gob.bo/index.php/s/JBTdoy9zNQ3dpA3/download"),
    "aemp": ("AEMP · Monitoreo enero 2023–junio 2024", "https://www.autoridadempresas.gob.bo/wp-content/uploads/2024/competencia/Monitoreo%20precios/Veh%C3%ADculos%20Automotores%20en%20Bolivia%20-%20ene2023-jun2024.pdf"),
    "nibol": ("Nibol · Sucursales", "https://www.nibol.com.bo/sucursales/"),
    "imcruz": ("Imcruz · Concesionarios y repuestos", "https://repuestos.imcruz.com/concesionarios"),
    "suzuki": ("Suzuki Bolivia · Oferta publicada", "https://www.suzuki.com.bo/"),
    "suzuki-network": ("Suzuki Bolivia · Red", "https://www.suzuki.com.bo/red/"),
    "kia": ("Kia Bolivia · Oferta publicada", "https://www.kia.com.bo/"),
    "kia-network": ("Kia Bolivia · Salones", "https://www.kia.com.bo/salones-kia-bolivia/"),
    "hyundai": ("Carmax · Hyundai Creta, ficha marzo 2026", "https://www.hyundai.com.bo/wp-content/uploads/2026/03/FT-CRETA-IMPRENTA_compressed.pdf"),
    "toyosa": ("Toyosa · Prado, ficha 2025", "https://paseos-virtuales.toyosa.com/prado-2025/LCPrado2025.pdf"),
    "hansa": ("Hansa · Unidades de negocio", "https://www.hansa.com.bo/"),
    "kwid-bo": ("Renault Bolivia · Kwid versiones", "https://www.renault.com.bo/auto/kwid/versiones"),
    "kardian-bo": ("Renault Bolivia · Kardian versiones", "https://www.renault.com.bo/auto/kardian/versiones"),
    "duster-bo": ("Renault Bolivia · Duster versiones", "https://www.renault.com.bo/auto/new-duster/versiones"),
    "oroch-bo": ("Renault Bolivia · Oroch versiones", "https://www.renault.com.bo/auto/new-oroch/versiones"),
    "js4-bo": ("JAC Bolivia · JS4 Luxury AT 2026", "https://www.jac.com.bo/cotizacion?id=4379&year=con+bono+marca"),
    "js4-pe": ("Derco Perú · JAC JS4 versiones", "https://www.derco.com.pe/modelos/jac/js4"),
    "kwid-pe": ("Derco Perú · Kwid Outsider 2026", "https://www.derco.com.pe/catalogo-derco/autos/renault/new-kwid/outsider-10-mt/2026/1016/cotizar"),
    "kicks-pe": ("Nissan Perú · Kicks Play, lista julio 2026", "https://www.nissan.pe/vehiculos/nuevos/nissan-kicks/precios.html"),
    "frontier-pe": ("Nissan Perú · Frontier, lista agosto 2026", "https://www.nissan.pe/vehiculos/nuevos/frontier/precios.html"),
    "nissan-pe-credit": ("Nissan Perú · Condiciones de promociones", "https://www.nissan.pe/infoprom.html"),
    "xtrail-cl": ("Nissan Chile · X-Trail", "https://www.nissan.cl/vehiculos/nuevos/x-trail.html"),
    "sentra-cl": ("Nissan Chile · Sentra", "https://www.nissan.cl/vehiculos/nuevos/sentra.html"),
    "renault-py": ("Renault Paraguay · Gama", "https://www.renault.com.py/range.html"),
    "kardian-ar": ("Renault Argentina · Kardian", "https://www.renault.com.ar/automoviles/renault-kardian.html"),
    "aduana": ("Aduana · Reglamento general", "https://www.aduana.gob.bo/rlga_view"),
    "aduana-circular": ("Aduana · Circulares 2026", "https://www.aduana.gob.bo/NOR_circulares?order=field_fechacir&page=1&sort=desc"),
    "bcb": ("BCB · Tipos de cambio 2026", "https://www.bcb.gob.bo/tiposDeCambioHistorico/pdf.php?anio=2026"),
    "asfi": ("ASFI · Sistema financiero diciembre 2025", "https://www.asfi.gob.bo/sites/default/files/2026-02/Evaluaci%C3%B3n%20del%20Sistema%20Financiero%20a%20Diciembre%20de%202025.pdf"),
}


def capture(item):
    key, (title, url) = item
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    record = dict(id=key, title=title, url=url, capturedAt=stamp)
    try:
        response = requests.get(url, timeout=55, headers={"User-Agent": "Mozilla/5.0 (compatible; ObservatorioEvidence/1.0)"})
        content = response.content
        record.update(httpStatus=response.status_code, bytes=len(content), sha256=hashlib.sha256(content).hexdigest(), resolvedUrl=response.url)
        extension = "pdf" if content[:4] == b"%PDF" else "html"
        record["format"] = extension
        archive = ROOT / "output" / "automotor" / record["sha256"]
        archive.mkdir(parents=True, exist_ok=True)
        (archive / f"{key}.{extension}").write_bytes(content)
        if extension == "html":
            soup = BeautifulSoup(content, "html.parser")
            for el in soup(["script", "style"]):
                el.decompose()
            (archive / f"{key}.txt").write_text(soup.get_text("\n", strip=True), encoding="utf-8")
        record["archive"] = f"output/automotor/{record['sha256']}/{key}.{extension}"
    except requests.RequestException as exc:
        record["error"] = type(exc).__name__
    return record


if __name__ == "__main__":
    manifest = ROOT / "src/data/automotive-sources.json"
    if manifest.exists():
        SOURCES.update({s["id"]: (s["title"], s["url"]) for s in json.loads(manifest.read_text(encoding="utf-8"))})
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        rows = list(executor.map(capture, SOURCES.items()))
    target = ROOT / "src/data/automotive-sources.json"
    target.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for row in rows:
        print(row["id"], row.get("httpStatus", row.get("error")), row.get("bytes", 0))
