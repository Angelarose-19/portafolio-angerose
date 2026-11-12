from pathlib import Path

import numpy as np
from PIL import Image

carpeta = Path(__file__).resolve().parent.parent / "public" / "images"

for ruta in sorted(carpeta.rglob("*.webp")):
    img = Image.open(ruta)
    alfa = np.array(img.convert("RGBA"))[..., 3]
    print(f"{str(ruta.relative_to(carpeta)):<32} modo={img.mode:<5} transparente: {(alfa < 250).mean() * 100:5.1f}%")