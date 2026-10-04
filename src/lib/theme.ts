/** Dónde se recuerda la elección de tema del lector. */
export const THEME_KEY = 'observatorio-tema';

/**
 * Corre antes de que se pinte la página: lee la elección guardada y la pone en
 * `<html>`. Sin esto el lector que eligió el tema contrario al de su sistema vería
 * un destello del otro antes de que React monte el botón. Falla en silencio: sin
 * almacenamiento (ventana privada, datos bloqueados) manda el tema del sistema.
 */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;
