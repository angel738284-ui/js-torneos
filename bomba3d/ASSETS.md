# JS Family Bomba Mortal — Modelos 3D

## Único modelo visible en la página

- \`models/js-rubber-mobile.glb\`: modelo GLB original enviado por el usuario, con texturas optimizadas a 1024px para navegadores Android.
- \`models/js-rubber-original.glb\`: copia intacta de la referencia suministrada, conservada como fuente de recuperación.
- SHA-256 de la fuente: \`1d87d5cb4eb498a9ff0f63461818d9c533974cff8c1058e1acc74ea54328c3e9\`.

El visor y la mesa comparten el mismo archivo GLB. Los personajes antiguos (2D y modelos procedurales) ya no se cargan ni aparecen en Bomba Mortal.

## Ropa diseñada para el GLB

\`wardrobe.js\` es el vestidor desarrollado para JS Family. Construye prendas siguiendo la malla original y genera accesorios 3D a partir de geometría propia. No depende de modelos de terceros ni compra modelos adicionales.

El selector \`wear3d\` (yes/no) se guarda con la función de avatar existente en Supabase, sin cambiar permisos ni lógica del juego. Los estilos antiguos quedan en los datos del avatar, pero ya no se muestran en la interfaz.

## Licencias y animación

- Three.js, GLTFLoader y utilidades: MIT. Licencia incluida en \`vendor/THREE_LICENSE.txt\`.
- El GLB suministrado no tiene esqueleto ni animaciones internas. Los movimientos actuales son de cuerpo completo, y la ropa sigue esos mismos movimientos. Para articular brazos o piernas habrá que añadir un rig posteriormente.

## Bomba gigante con las dos manos (noviembre 2026)

- `bomb-effects.js` crea una bomba 3D enorme (radio 0,54), con mecha, chispa e iluminación, compartiendo geometrías entre 24 jugadores.
- `two-hand-pose.js` agrega un *morph target* en GPU a la malla original: deforma ambos brazos para abrazar la bomba mientras la sostienen, y revierte la pose al lanzarla. No requiere un esqueleto externo.
- `wardrobe.js` adapta también las mangas al morph. `imported.js` añade dos puntas de manos del mismo color de cada muñeco y sincroniza la pose de abrazo, lanzamiento y recepción.
- El lanzamiento solo ocurre cuando la partida confirma el pase; la demo tiene una prueba visual que no modifica la partida.
- Son poses procedurales y no animaciones esqueléticas separadas para los dedos.

## Mecha que se consume en tiempo real (19/11/2026)

- `bomb-effects.js` reduce la longitud de la mecha desde la punta y mueve la brasa y su luz progresivamente hacia el capuchón; el destello se acelera a medida que se agota.
- La duración es la **ronda real** (`ronda_inicio` y `vencimiento`) recibida de Supabase y ajustada con el desplazamiento del reloj (`servidor_ahora`); no hay un límite fijo ficticio.
- La mecha conserva el avance al cambiar de dueño y también durante el vuelo. Se reinicia solo con una nueva ronda.
- La explosión y las eliminaciones siguen siendo responsabilidad del servidor; la demo tiene un contador visual independiente que no altera partidas reales.
- Con movimiento reducido, la mecha se acorta pero la luz no parpadea.
