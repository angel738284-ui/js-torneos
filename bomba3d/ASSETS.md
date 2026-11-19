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
