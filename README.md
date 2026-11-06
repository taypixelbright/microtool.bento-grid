# Bento Grid Generator (plugin de Figma)

Genera grillas tipo *bento* de **X columnas × Y filas**, fusionando celdas vecinas al azar
hasta obtener exactamente **N bloques**, cada uno como un frame con auto layout.

## Instalación (desarrollo local)

1. Abre Figma Desktop.
2. Menú **Plugins → Development → Import plugin from manifest…**
3. Selecciona `manifest.json` de esta carpeta.
4. Ejecuta **Plugins → Development → Bento Grid Generator**.

No hay build ni dependencias: `code.js` es JavaScript plano.

## Cómo funciona

- Se parte de `cols × rows` bloques de 1×1.
- Se fusionan al azar dos bloques adyacentes que formen un rectángulo (misma fila y altura, o misma columna y ancho).
- Se repite hasta llegar a N bloques. Siempre se obtiene un teselado exacto, sin huecos ni solapes.
- Si no se puede llegar a N (muy raro), se reintenta hasta 40 veces y se avisa con el número más cercano.

## Parámetros

| Parámetro | Descripción |
|---|---|
| Columnas / Filas | Tamaño de la grilla base. |
| Bloques (n) | Cantidad de auto layouts a crear (se limita a `cols × rows`). |
| Ancho / Alto del frame | Tamaño del frame contenedor. |
| Gap, Padding | Separación entre bloques y margen del frame. |
| Padding / Radio de bloque | Estilo de cada tarjeta. |
| Máx. span cols / filas | Limita cuántas celdas puede abarcar un bloque (0 = sin límite). |
| Variedad de tamaños | 0 = fusiones uniformes; valores altos favorecen mezclar bloques grandes y pequeños. |
| Semilla | Texto cualquiera para reproducir un resultado. Vacío = aleatorio. |
| Grid auto layout | Usa el Grid nativo de Figma (`layoutMode: "GRID"` con spans). Si tu versión no lo soporta, cae a posición absoluta. |
| Guías | Añade layout grids de columnas y filas al frame, como en la referencia. |
| Etiquetas | Texto `n · w×h` dentro de cada bloque (fuente Inter Medium). |

## Estructura generada

```
Bento 4×4 · 7 bloques · seed 123   (FRAME, Grid auto layout)
├─ Bloque 1 · 2×1   (FRAME, auto layout vertical, FILL en ambos ejes)
├─ Bloque 2 · 1×2
└─ …
```

Cada bloque guarda su posición y span, por lo que puedes cambiar gaps o el tamaño del frame
y la grilla se recalcula sola.
