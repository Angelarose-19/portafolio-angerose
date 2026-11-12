"""
Procesa los assets originales (tools/originales) y los deja listos en public/images.

Uso:
    python tools\\procesar_assets.py              -> procesa todo
    python tools\\procesar_assets.py gato juego   -> procesa solo esos grupos

Grupos: muneca, gato, escena, juego, efectos
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage as ndi

# ---------------------------------------------------------------- Rutas
RAIZ = Path(__file__).resolve().parent.parent
ORIGINALES = RAIZ / "tools" / "originales"
SALIDA = RAIZ / "public" / "images"
VISTAS = RAIZ / "tools" / "preview"

# ---------------------------------------------------------------- Ajustes
# Un pixel se considera "fondo blanco" si su canal más bajo es >= este valor.
# Si quedan restos blancos, baja a 245. Si se come pelaje blanco, sube a 253.
BG_MIN = 251

# Multiplicador de tamaño por cuadro del salto: [subiendo, cima, cayendo].
# Si en la vista previa un cuadro se ve más pequeño o grande, ajusta aquí (ej. 1.1).
ESCALA_SALTO = [1.0, 1.0, 1.0]

# Nombres de los efectos extraídos de la hoja de poses.
# Se completa después de mirar tools/preview/efectos.png. Ejemplo: {1: "corazon-1"}
NOMBRES_EFECTOS: dict[int, str] = {
    1: "corazones-pixel",
    2: "corazon",
    3: "estrella",
    4: "gema",
    5: "huella",
    6: "ovillo",
    7: "lineas-velocidad",
    8: "polvo",
    9: "destellos-grupo",
    10: "destello-1",
    11: "destello-2",
    12: "destello-3",
    13: "corazon-contorno",
}

ESTRUCTURA = np.ones((3, 3), dtype=bool)
RES = Image.Resampling.LANCZOS


# ---------------------------------------------------------------- Utilidades
def cargar(nombre: str) -> np.ndarray:
    ruta = ORIGINALES / nombre
    if not ruta.exists():
        raise FileNotFoundError(f"No encuentro {ruta}")
    return np.array(Image.open(ruta).convert("RGBA"))


def tiene_transparencia(arr: np.ndarray) -> bool:
    return float((arr[..., 3] < 250).mean()) > 0.02


def recortar(arr: np.ndarray, umbral: int = 8) -> np.ndarray:
    ys, xs = np.where(arr[..., 3] > umbral)
    if len(ys) == 0:
        return arr
    return arr[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def ajustar(img: Image.Image, lado_max: int) -> Image.Image:
    """Reduce (nunca amplía) hasta que el lado mayor mida lado_max."""
    copia = img.copy()
    copia.thumbnail((lado_max, lado_max), RES)
    return copia


def guardar_webp(img: Image.Image, ruta_relativa: str, calidad: int = 90) -> None:
    destino = SALIDA / ruta_relativa
    destino.parent.mkdir(parents=True, exist_ok=True)
    if img.mode != "RGBA":
        img = img.convert("RGB")
    img.save(destino, "WEBP", quality=calidad, method=6)
    kb = destino.stat().st_size / 1024
    print(f"  OK  {ruta_relativa:<34} {img.width}x{img.height}  {kb:,.0f} KB")


def vista_previa(imgs, nombre, etiquetas=None, alto=300) -> None:
    """Pega las imágenes sobre el morado del sitio para detectar halos blancos."""
    VISTAS.mkdir(parents=True, exist_ok=True)
    piezas = []
    for im in imgs:
        k = alto / im.height
        piezas.append(im.convert("RGBA").resize((max(1, round(im.width * k)), alto), RES))
    ancho = sum(p.width for p in piezas) + 16 * (len(piezas) + 1)
    lienzo = Image.new("RGBA", (ancho, alto + 48), (26, 11, 46, 255))
    dibujo = ImageDraw.Draw(lienzo)
    x = 16
    for n, pieza in enumerate(piezas):
        lienzo.alpha_composite(pieza, (x, 32))
        dibujo.text((x, 8), etiquetas[n] if etiquetas else str(n + 1), fill=(255, 122, 200, 255))
        x += pieza.width + 16
    lienzo.convert("RGB").save(VISTAS / f"{nombre}.png")


# ---------------------------------------------------------------- Quitar fondo
def encontrar_huecos_de_cabello(rgb, candidato, fondo) -> np.ndarray:
    """
    Huecos de blanco encerrados (entre rizos). Solo se borran si están rodeados
    de color oscuro: así se conservan medias, zapatos y brillos de los ojos.
    """
    luz = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    etiquetas, _ = ndi.label(candidato & ~fondo)
    huecos = np.zeros_like(candidato)

    for i, sl in enumerate(ndi.find_objects(etiquetas), start=1):
        if sl is None:
            continue
        pad = 8
        ys = slice(max(sl[0].start - pad, 0), sl[0].stop + pad)
        xs = slice(max(sl[1].start - pad, 0), sl[1].stop + pad)

        comp = etiquetas[ys, xs] == i
        if comp.sum() < 40:
            continue

        anillo = ndi.binary_dilation(comp, structure=ESTRUCTURA, iterations=5)
        anillo &= ~comp & ~fondo[ys, xs]
        if anillo.sum() == 0:
            continue

        luz_anillo = luz[ys, xs][anillo]
        if luz_anillo.mean() < 80 and (luz_anillo > 140).mean() < 0.05:
            huecos[ys, xs] |= comp

    return huecos
def quitar_fondo(arr: np.ndarray, limpiar_huecos: bool = False) -> np.ndarray:
    """Si la imagen ya trae transparencia, la respeta. Si no, quita el blanco."""
    if tiene_transparencia(arr):
        print("  (ya trae transparencia: no se toca el fondo)")
        return arr
    return quitar_fondo_blanco(arr, limpiar_huecos)


def quitar_fondo_blanco(arr: np.ndarray, limpiar_huecos: bool = False) -> np.ndarray:
    """
    Quita el blanco conectado al borde de la imagen (no el blanco interior del
    gato) y suaviza el contorno para que no quede halo blanco.
    """
    rgb = arr[..., :3].astype(np.float32)
    minimo = rgb.min(axis=2)
    candidato = minimo >= BG_MIN

    # La apertura bloquea "fugas" por rendijas finas hacia el interior del dibujo.
    nucleo = ndi.binary_opening(candidato, structure=ESTRUCTURA)
    etiquetas, _ = ndi.label(nucleo)
    ids = np.unique(
        np.concatenate([etiquetas[0, :], etiquetas[-1, :], etiquetas[:, 0], etiquetas[:, -1]])
    )
    fondo = np.isin(etiquetas, ids[ids != 0])
    fondo = ndi.binary_dilation(fondo, structure=ESTRUCTURA, iterations=3) & candidato

    if limpiar_huecos:
        fondo |= encontrar_huecos_de_cabello(rgb, candidato, fondo)

    # Borde: estima la transparencia real del pixel y quita el blanco mezclado.
    borde = ndi.binary_dilation(fondo, structure=ESTRUCTURA, iterations=2) & ~fondo
    alfa_borde = np.clip(1.0 - minimo / 255.0, 0.0, 1.0)
    alfa_borde[alfa_borde < 0.08] = 0.0
    seguro = np.maximum(alfa_borde, 0.08)[..., None]
    recuperado = np.clip((rgb - 255.0 * (1.0 - alfa_borde[..., None])) / seguro, 0, 255)

    salida = np.empty_like(arr)
    salida[..., :3] = np.where(borde[..., None], recuperado, rgb).round().astype(np.uint8)
    alfa = np.where(fondo, 0.0, np.where(borde, alfa_borde, 1.0))
    salida[..., 3] = (alfa * 255).round().astype(np.uint8)
    return salida


# ---------------------------------------------------------------- Tiras de cuadros
def separar_tira(arr: np.ndarray, esperado: int, ancho_min: int = 25, hueco: int = 6):
    columnas = (arr[..., 3] > 8).any(axis=0)
    tramos: list[list[int]] = []
    inicio = None
    for x, activa in enumerate(columnas):
        if activa and inicio is None:
            inicio = x
        elif not activa and inicio is not None:
            tramos.append([inicio, x])
            inicio = None
    if inicio is not None:
        tramos.append([inicio, len(columnas)])

    unidos: list[list[int]] = []
    for tramo in tramos:
        if unidos and tramo[0] - unidos[-1][1] < hueco:
            unidos[-1][1] = tramo[1]
        else:
            unidos.append(tramo)
    unidos = [t for t in unidos if t[1] - t[0] >= ancho_min]

    if len(unidos) != esperado:
        print(f"  AVISO: encontré {len(unidos)} cuadros y esperaba {esperado}. Divido en partes iguales.")
        paso = arr.shape[1] / esperado
        unidos = [[round(i * paso), round((i + 1) * paso)] for i in range(esperado)]

    return [arr[:, a:b] for a, b in unidos]


def construir_cuadros(frames, escalas=None, alto_lienzo=512, margen=12):
    """Mismo lienzo para todos, pies abajo y centro de masa en el centro."""
    recortados = [recortar(f) for f in frames]
    escalas = escalas or [1.0] * len(recortados)
    alto_max = max(r.shape[0] * e for r, e in zip(recortados, escalas))
    k = (alto_lienzo - 2 * margen) / alto_max

    piezas = []
    for r, e in zip(recortados, escalas):
        h, w = r.shape[:2]
        img = Image.fromarray(r).resize((max(1, round(w * k * e)), max(1, round(h * k * e))), RES)
        alfa = np.asarray(img)[..., 3].astype(np.float64)
        cx = float((alfa.sum(axis=0) * np.arange(alfa.shape[1])).sum() / alfa.sum())
        piezas.append((img, cx))

    mitad = max(max(cx, img.width - cx) for img, cx in piezas)
    ancho = int(math.ceil(mitad * 2)) + 2 * margen

    salida = []
    for img, cx in piezas:
        lienzo = Image.new("RGBA", (ancho, alto_lienzo), (0, 0, 0, 0))
        x = round(ancho / 2 - cx)
        y = max(0, alto_lienzo - margen - img.height)
        lienzo.alpha_composite(img, (x, y))
        salida.append(lienzo)
    return salida


# ---------------------------------------------------------------- Gato feliz + corazón
def separar_corazon(arr: np.ndarray):
    """Separa el corazón rosa del gato para poder animarlo aparte."""
    solido = arr[..., 3] > 8
    etiquetas, n = ndi.label(solido)
    if n == 0:
        return arr, None

    areas = ndi.sum(solido, etiquetas, index=range(1, n + 1))
    mayor = int(np.argmax(areas)) + 1
    mascara_corazon = np.zeros_like(solido)

    for i in range(1, n + 1):
        if i == mayor or areas[i - 1] < 800:
            continue
        pix = arr[etiquetas == i][:, :3].astype(np.float32)
        if pix[:, 0].mean() - pix[:, 1].mean() > 80:  # muy rosa
            mascara_corazon |= etiquetas == i

    if not mascara_corazon.any():
        return arr, None

    gato = arr.copy()
    gato[mascara_corazon, 3] = 0
    corazon = arr.copy()
    corazon[~mascara_corazon, 3] = 0
    return gato, corazon


# ---------------------------------------------------------------- Grupos de trabajo
def procesar_muneca() -> None:
    print("Muñeca")
    arr = cargar("muneca-inicio.png")
    if not tiene_transparencia(arr):
        arr = quitar_fondo(arr, limpiar_huecos=True)
    img = Image.fromarray(recortar(arr))
    guardar_webp(ajustar(img, 1000), "muneca/inicio.webp")
    vista_previa([img], "muneca-inicio", alto=500)

    for archivo, esperado, prefijo, escalas in (
        ("muneca-correr.png", 6, "correr", None),
        ("muneca-saltar.png", 3, "saltar", ESCALA_SALTO),
    ):
        arr = quitar_fondo(cargar(archivo), limpiar_huecos=True)
        cuadros = construir_cuadros(separar_tira(arr, esperado), escalas)
        for i, cuadro in enumerate(cuadros, start=1):
            guardar_webp(cuadro, f"muneca/{prefijo}-{i}.webp")
        vista_previa(cuadros, prefijo)
        print(f"  Lienzo de {prefijo}: {cuadros[0].width}x{cuadros[0].height} px")


def procesar_gato() -> None:
    print("Gato")
    dormido = recortar(quitar_fondo(cargar("gato-dormido.png")))
    img = Image.fromarray(dormido)
    guardar_webp(ajustar(img, 900), "gato/dormido.webp")
    vista_previa([img], "gato-dormido", alto=400)

    feliz = quitar_fondo(cargar("gato-feliz.png"))
    gato, corazon = separar_corazon(feliz)
    img_gato = Image.fromarray(recortar(gato))
    guardar_webp(ajustar(img_gato, 900), "gato/feliz.webp")
    previas = [img_gato]
    if corazon is not None:
        img_corazon = Image.fromarray(recortar(corazon))
        guardar_webp(ajustar(img_corazon, 160), "efectos/corazon-gato.webp")
        previas.append(img_corazon)
    else:
        print("  AVISO: no encontré el corazón aparte; queda dentro de gato/feliz.webp")
    vista_previa(previas, "gato-feliz", alto=400)


def procesar_escena() -> None:
    print("Escena")
    habitacion = Image.open(ORIGINALES / "habitacion.png").convert("RGB")
    habitacion = ajustar(habitacion, 1400)
    guardar_webp(habitacion, "escena/habitacion.webp", calidad=85)

    ancha = Image.open(ORIGINALES / "habitacion-ancha.png").convert("RGB")
    ancha = ajustar(ancha, 1920)
    guardar_webp(ancha, "escena/habitacion-ancha.webp", calidad=85)

    for archivo, destino, lado in (("laptop.png", "escena/laptop.webp", 900), ("taza.png", "escena/taza.webp", 500)):
        img = Image.fromarray(recortar(quitar_fondo(cargar(archivo))))
        guardar_webp(ajustar(img, lado), destino)
        vista_previa([img], destino.split("/")[1].replace(".webp", ""), alto=400)


def procesar_juego() -> None:
    print("Juego")
    fondo = Image.open(ORIGINALES / "fondo-juego.png").convert("RGB")
    fondo = ImageOps.fit(fondo, (1600, 900), method=RES)
    guardar_webp(fondo, "juego/fondo.webp", calidad=82)

    for archivo, destino, lado in (
        ("plataforma-larga.png", "juego/plataforma-larga.webp", 900),
        ("plataforma-corta.png", "juego/plataforma-corta.webp", 700),
    ):
        img = Image.fromarray(recortar(quitar_fondo(cargar(archivo))))
        guardar_webp(ajustar(img, lado), destino)
        vista_previa([img], destino.split("/")[1].replace(".webp", ""), alto=300)


def procesar_efectos() -> None:
    print("Efectos (desde la hoja de poses)")
    arr = quitar_fondo(cargar("hoja-poses.png"))
    alto_hoja = arr.shape[0]
    solido = arr[..., 3] > 8

    agrupado = ndi.binary_dilation(solido, structure=ESTRUCTURA, iterations=4)
    etiquetas, _ = ndi.label(agrupado)

    encontrados = []
    for i, sl in enumerate(ndi.find_objects(etiquetas), start=1):
        if sl is None:
            continue
        mascara = (etiquetas[sl] == i) & solido[sl]
        if mascara.sum() < 120:
            continue
        ys, _ = np.nonzero(mascara)
        centro_y = sl[0].start + ys.mean()
        if centro_y < alto_hoja * 0.885:  # solo la fila inferior (los efectos)
            continue
        recorte = arr[sl].copy()
        recorte[~mascara, 3] = 0
        encontrados.append((sl[1].start, recorte))

    encontrados.sort(key=lambda t: t[0])
    imagenes, etiquetas_txt = [], []
    for n, (_, recorte) in enumerate(encontrados, start=1):
        img = ajustar(Image.fromarray(recortar(recorte)), 128)
        nombre = NOMBRES_EFECTOS.get(n, f"efecto-{n:02d}")
        guardar_webp(img, f"efectos/{nombre}.webp")
        imagenes.append(img)
        etiquetas_txt.append(f"{n}")
    if imagenes:
        vista_previa(imagenes, "efectos", etiquetas_txt, alto=120)
    print(f"  Encontré {len(encontrados)} efectos (numerados de izquierda a derecha)")

def procesar_pose_paz() -> None:
    """Saca la pose del guiño con la 'V' (fila 1, tercera) de la hoja de poses."""
    print("Muñeca: pose del signo de paz")
    arr = quitar_fondo(cargar("hoja-poses.png"))
    alto, ancho = arr.shape[:2]

    # Caja aproximada de esa pose (fracciones de la hoja).
    # Si se corta o entra parte de otra pose, ajusta estos números.
    x0, x1 = int(ancho * 0.30), int(ancho * 0.445)
    y0, y1 = 0, int(alto * 0.32)
    caja = arr[y0:y1, x0:x1].copy()

    solido = caja[..., 3] > 8
    agrupado = ndi.binary_dilation(solido, structure=ESTRUCTURA, iterations=4)
    etiquetas, n = ndi.label(agrupado)
    if n == 0:
        print("  AVISO: no encontré nada en esa caja")
        return

    # Me quedo con la pieza más grande (la muñeca) y quito corazones o restos vecinos.
    areas = ndi.sum(solido, etiquetas, index=range(1, n + 1))
    mayor = int(np.argmax(areas)) + 1
    caja[~((etiquetas == mayor) & solido), 3] = 0

    img = Image.fromarray(recortar(caja))
    guardar_webp(ajustar(img, 600), "muneca/paz.webp")
    vista_previa([img], "muneca-paz", alto=500)

PROYECTOS = {
    "licoctel.png": "licoctel",
    "invitacion-quince.png": "invitacion-quince",
    "portafolio.png": "portafolio",
}


def procesar_proyectos() -> None:
    print("Proyectos")
    for archivo, nombre in PROYECTOS.items():
        ruta = ORIGINALES / "proyectos" / archivo
        if not ruta.exists():
            print(f"  AVISO: no encuentro {ruta}")
            continue
        img = Image.open(ruta).convert("RGB")
        guardar_webp(ajustar(img, 1400), f"proyectos/{nombre}.webp", calidad=85)

def procesar_pose_laptop() -> None:
    """Saca la pose sentada con laptop (fila 1, séptima) de la hoja de poses."""
    print("Muñeca: pose sentada con laptop")
    arr = quitar_fondo(cargar("hoja-poses.png"))
    alto, ancho = arr.shape[:2]

    # Caja aproximada de esa pose (fracciones de la hoja).
    # Si se corta o entra parte de otra pose, ajusta estos números.
    x0, x1 = int(ancho * 0.85), ancho
    y0, y1 = 0, int(alto * 0.32)
    caja = arr[y0:y1, x0:x1].copy()

    solido = caja[..., 3] > 8
    agrupado = ndi.binary_dilation(solido, structure=ESTRUCTURA, iterations=4)
    etiquetas, n = ndi.label(agrupado)
    if n == 0:
        print("  AVISO: no encontré nada en esa caja")
        return

    # Me quedo con la pieza más grande (muñeca + laptop) y quito restos vecinos.
    areas = ndi.sum(solido, etiquetas, index=range(1, n + 1))
    mayor = int(np.argmax(areas)) + 1
    caja[~((etiquetas == mayor) & solido), 3] = 0

    img = Image.fromarray(recortar(caja))
    guardar_webp(ajustar(img, 600), "muneca/laptop.webp")
    vista_previa([img], "muneca-laptop", alto=500)

def extraer_pose(x0f, x1f, y0f, y1f, destino, nombre_vista, lado=600) -> None:
    """Recorta una pose de la hoja (en fracciones de ancho y alto) y conserva solo la pieza más grande."""
    arr = quitar_fondo(cargar("hoja-poses.png"))
    alto, ancho = arr.shape[:2]
    caja = arr[int(alto * y0f) : int(alto * y1f), int(ancho * x0f) : int(ancho * x1f)].copy()

    solido = caja[..., 3] > 8
    agrupado = ndi.binary_dilation(solido, structure=ESTRUCTURA, iterations=2)
    etiquetas, n = ndi.label(agrupado)
    if n == 0:
        print(f"  AVISO: no encontré nada para {destino}")
        return

    areas = ndi.sum(solido, etiquetas, index=range(1, n + 1))
    mayor = int(np.argmax(areas)) + 1
    caja[~((etiquetas == mayor) & solido), 3] = 0

    img = Image.fromarray(recortar(caja))
    guardar_webp(ajustar(img, lado), destino)
    vista_previa([img], nombre_vista, alto=400)


def procesar_poses_juego() -> None:
    print("Muñeca: poses de la pantalla final")
    # Fila 3 de la hoja. Si se corta o entra algo de otra pose, ajusta estas fracciones.
    extraer_pose(0.205, 0.345, 0.59, 0.885, "muneca/sentada.webp", "muneca-sentada")
    extraer_pose(0.345, 0.505, 0.59, 0.885, "muneca/celebra.webp", "muneca-celebra")

GRUPOS = {
    "muneca": procesar_muneca,
    "gato": procesar_gato,
    "escena": procesar_escena,
    "juego": procesar_juego,
    "efectos": procesar_efectos,
    "paz": procesar_pose_paz,
    "proyectos": procesar_proyectos,
    "pose-laptop": procesar_pose_laptop,
    "poses-juego": procesar_poses_juego,
}


def main() -> None:
    seleccion = sys.argv[1:] or list(GRUPOS)
    for nombre in seleccion:
        if nombre not in GRUPOS:
            print(f"Grupo desconocido: {nombre}. Opciones: {', '.join(GRUPOS)}")
            continue
        try:
            GRUPOS[nombre]()
        except FileNotFoundError as error:
            print(f"  ERROR: {error}")
    print(f"\nListo. Revisa las vistas previas en: {VISTAS}")


if __name__ == "__main__":
    main()