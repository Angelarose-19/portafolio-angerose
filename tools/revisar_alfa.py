from pathlib import Path

import numpy as np
from PIL import Image

carpeta = Path(__file__).resolve().parent / "originales"

for ruta in sorted(carpeta.glob("*.png")):
    img = Image.open(ruta)
    alfa = np.array(img.convert("RGBA"))[..., 3]
    transparente = (alfa < 250).mean() * 100
    print(f"{ruta.name:<24} modo={img.mode:<5} píxeles transparentes: {transparente:5.1f}%")