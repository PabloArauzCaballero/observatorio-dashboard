/*
 * El monograma DB de DatosBolivia.com: una D en tinta con el grabado numismático
 * del manual y una B en oro montada sobre su panza.
 *
 * Los contornos son de Newsreader (OFL) a peso 800, convertidos a trazado para
 * que la marca no dependa de que la fuente haya cargado. Es una versión
 * simplificada del arte del manual, hecha para pantalla: por debajo de 48 px
 * el grabado se quita (regla móvil del manual) y queda la silueta.
 *
 * Generado por scratchpad/tools/build-brand.mjs; para cambiar la geometría se
 * vuelve a correr, no se edita a mano.
 */

const D = 'M1131 -693Q1131 -952 1027.5 -1070.0Q924 -1188 735 -1188H441L399 -1352H784Q1044 -1352 1216.0 -1282.0Q1388 -1212 1474.0 -1070.0Q1560 -928 1560 -714Q1560 -487 1459.0 -327.5Q1358 -168 1182.5 -84.0Q1007 0 784 0H399L441 -164H754Q870 -164 954.5 -218.0Q1039 -272 1085.0 -389.0Q1131 -506 1131 -693ZM65 0V-61L208 -121V-1231L65 -1291V-1352H622V0Z';
const B = 'M430 -1194 447 -1352H905Q1066.937125748503 -1352.0 1167.4685628742513 -1310.5Q1268 -1269 1314.0 -1197.0Q1360 -1125 1360 -1034Q1360 -907 1272.255 -822.0Q1184.51 -737.0 1030 -723L1033 -739Q1224 -729 1333.5 -630.8878504672897Q1443.0 -532.7757009345794 1443 -381Q1443 -271 1387.5375 -184.26124567474048Q1332.075 -97.52249134948097 1213.5375 -48.761245674740486Q1095 0 905 0H448L428 -158H754Q834.9879032258065 -158.0 891.9939516129032 -183.5Q949 -209 979.0 -264.3745980707396Q1009.0 -319.7491961414791 1009.0 -407.31832797427654Q1009 -476 983.1829652996846 -528.3769633507853Q957.3659305993691 -580.7539267015707 902.602523659306 -610.3769633507853Q847.839116719243 -640.0 761 -640H427L430 -791H755Q842.9239543726236 -791.0 892.9619771863117 -843.0Q943 -895 943.0 -1000.4285714285714Q943 -1059 921.0 -1102.5Q899 -1146 853.28 -1170.0Q807.56 -1194.0 737 -1194ZM65 0V-61L208 -121V-1231L65 -1291V-1352H623V0Z';
const GRABADO = 'M520 -1440 C780 -1000 120 -420 380 60 M597 -1440 C849 -1000 193 -420 444 60 M674 -1440 C917 -1000 266 -420 509 60 M751 -1440 C986 -1000 339 -420 573 60 M829 -1440 C1054 -1000 411 -420 637 60 M906 -1440 C1123 -1000 484 -420 701 60 M983 -1440 C1191 -1000 557 -420 766 60 M1060 -1440 C1260 -1000 630 -420 830 60 M1137 -1440 C1329 -1000 703 -420 894 60 M1214 -1440 C1397 -1000 776 -420 959 60 M1291 -1440 C1466 -1000 849 -420 1023 60 M1369 -1440 C1534 -1000 921 -420 1087 60 M1446 -1440 C1603 -1000 994 -420 1151 60 M1523 -1440 C1671 -1000 1067 -420 1216 60 M1600 -1440 C1740 -1000 1140 -420 1280 60';
const B_X = 1180;

export function Monogram({
  size = 40,
  detail,
  title = 'DatosBolivia.com',
  className,
}: {
  /** Ancho en píxeles; el alto sale de la proporción. */
  size?: number;
  /** Con grabado. Por defecto, solo cuando el monograma mide 48 px o más. */
  detail?: boolean;
  /** Nombre accesible; vacío si el monograma va junto al nombre escrito. */
  title?: string;
  className?: string;
}) {
  const conGrabado = detail ?? size >= 48;
  const id = `db-${size}`;
  return (
    <svg
      className={className ? `monogram ${className}` : 'monogram'}
      viewBox="-30 -1400 2743 1440"
      width={size}
      height={Math.round((size * 1440) / 2743)}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <clipPath id={`${id}-d`}>
          <path d={D} />
        </clipPath>
      </defs>
      <path d={B} transform={`translate(${B_X} 0)`} fill="var(--gold)" />
      <path d={D} fill="var(--masthead-ink)" stroke="var(--paper)" strokeWidth={56} paintOrder="stroke" />
      {conGrabado ? (
        <g clipPath={`url(#${id}-d)`}>
          <path
            d={GRABADO}
            fill="none"
            stroke="var(--gold)"
            strokeWidth={15}
            strokeLinecap="round"
            opacity={0.9}
          />
        </g>
      ) : null}
    </svg>
  );
}
