import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import procesar_assets as p

arr = p.cargar("laptop.png")
print("alfa transparente del original :", round(float((arr[..., 3] < 250).mean()) * 100, 1), "%")
print("tiene_transparencia devuelve   :", p.tiene_transparencia(arr))

salida = p.quitar_fondo(arr)
print("alfa transparente tras quitar_fondo:", round(float((salida[..., 3] < 250).mean()) * 100, 1), "%")