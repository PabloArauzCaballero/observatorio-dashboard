/**
 * Autor, licencia y origen de las imágenes de terceros del tablero (fotos de personas y de
 * vehículos, y algunas marcas), todas de Wikimedia Commons con licencia libre. Se muestran en
 * «Método › Créditos de las imágenes». Al añadir una imagen nueva se anota aquí.
 */
export interface ImageCredit {
  kind: 'Personas' | 'Vehículos' | 'Marcas';
  name: string;
  author: string;
  license: string;
  source: string;
}

export const IMAGE_CREDITS: readonly ImageCredit[] = [
  {
    "kind": "Personas",
    "name": "Marcelo Claure",
    "author": "Willie T. Jacobs of W T Jacobs Photography",
    "license": "CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Headshot_of_Marcelo_Claure.jpg"
  },
  {
    "kind": "Personas",
    "name": "Miguel Krigsner",
    "author": "Marcos Corrêa",
    "license": "CC BY 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Miguel_Krigsner_discursando_na_Cerim%C3%B4nia_de_Entrega_do_XXIX_Pr%C3%AAmio_Jovem_Cientista_(cropped).jpg"
  },
  {
    "kind": "Personas",
    "name": "Samuel Doria Medina",
    "author": "Asamblea Legislativa Plurinacional",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Samuel_Doria_Medina_2020.jpg"
  },
  {
    "kind": "Personas",
    "name": "Rodrigo Paz Pereira",
    "author": "Lula Oficial",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Rodrigo_Paz_enero_2026.jpg"
  },
  {
    "kind": "Personas",
    "name": "Edmand Lara",
    "author": "Sebastián Rodríguez / Presidencia de Chile",
    "license": "CC BY 3.0 cl",
    "source": "https://commons.wikimedia.org/wiki/File:Edmand_Lara_2025_(cropped).jpg"
  },
  {
    "kind": "Personas",
    "name": "Jorge Quiroga",
    "author": "Colección Antonio Suárez, La Paz / Plurinational Legislative Assembly",
    "license": "CC BY 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:President_Jorge_Quiroga_1.jpg"
  },
  {
    "kind": "Personas",
    "name": "Luis Arce Catacora",
    "author": "Government of Bolivia",
    "license": "CC BY 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Luis_Alberto_Arce_Catacora_(Official_Portrait,_2020)_Cropped_II.png"
  },
  {
    "kind": "Personas",
    "name": "Carlos Mesa",
    "author": "Antonio Suárez",
    "license": "CC BY 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Carlos_Mesa._Su%C3%A1rez,_Antonio._2004,_Antonio_Su%C3%A1rez_collection,_La_Paz.jpg"
  },
  {
    "kind": "Personas",
    "name": "Evo Morales",
    "author": "EneasMx",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Evo_Morales_Ayma_(cropped_3).jpg"
  },
  {
    "kind": "Personas",
    "name": "Manfred Reyes Villa",
    "author": "ElBarcobasurero",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:ManfredReyesVilla_Cropped.jpg"
  },
  {
    "kind": "Personas",
    "name": "Eva Copa",
    "author": "uverhq",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Monica_Eva_Copa_Murga.jpg"
  },
  {
    "kind": "Personas",
    "name": "Anabel Angus",
    "author": "Su fotógrafo",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Anabel-angus-representara-a-bolivia-en-el-evento-bata-fashion-weekend-en-praga-727119_(1).jpg"
  },
  {
    "kind": "Personas",
    "name": "María Galindo",
    "author": "Lina Etchesuri / Lavaca.org",
    "license": "Atribución",
    "source": "https://commons.wikimedia.org/wiki/File:Mariagalindo.jpg"
  },
  {
    "kind": "Personas",
    "name": "Elvira Espejo Ayca",
    "author": "Ministerio de Cultura de la Nación",
    "license": "CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Elvira_Espejo_Ayca_(cropped).jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan Frontier",
    "author": "Ethan Llamas",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_Navara_(D23)_2.5_PRO-4X_4x4_2023_(1).jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan Frontier CS",
    "author": "Ethan Llamas",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_Navara_(D23)_2.5_VE_Calibre_4x2_2022.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan Kicks",
    "author": "Alexander Migl",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_Kicks_(P16)_DSC_2875.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan Pathfinder",
    "author": "OWS Photography",
    "license": "CC BY 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_Pathfinder_(R53)_Washington_DC_Metro_Area,_USA.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan Sentra",
    "author": "Martin1515rr",
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_Sentra_(B18).jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan Versa",
    "author": "HJUdall",
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:23_Nissan_Versa_SR.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan X-Trail",
    "author": "Alexander-93",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_X-Trail_(T33)_1X7A7179.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Nissan X-Trail e-POWER",
    "author": "Alexander-93",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nissan_X-Trail_e-Power_1X7A7056.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Renault Kwid",
    "author": "Aswïn KP",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Renault_KWID_RXT(O).jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Renault Kardian",
    "author": "Just a Man",
    "license": "CC BY 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:2024_Renault_Kardian_1.0_200_EDC_Premiere_Edition,_front.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Renault Duster",
    "author": "Just a Man",
    "license": "CC BY 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:2024_Renault_Duster_1.3_TCe_Turbo_Iconic.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "Renault Oroch",
    "author": "RL GNZLZ",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Renault_Duster_Oroch_Intens_2020.jpg"
  },
  {
    "kind": "Vehículos",
    "name": "JAC JS4",
    "author": "RL GNZLZ",
    "license": "CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:2021_JAC_JS4_1.6_Comfort.jpg"
  },
  {
    "kind": "Marcas",
    "name": "Empresa Nacional de Electricidad (ENDE)",
    "author": "Joaquin Eduardo Vargas",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ende.png"
  },
  {
    "kind": "Marcas",
    "name": "Viva (Nuevatel PCS de Bolivia)",
    "author": "VIVA",
    "license": "Dominio público",
    "source": "https://commons.wikimedia.org/wiki/File:VIVA2020.png"
  },
  {
    "kind": "Marcas",
    "name": "Tigo (Telefónica Celular de Bolivia)",
    "author": "Millicom International Cellular S.A.",
    "license": "Dominio público",
    "source": "https://commons.wikimedia.org/wiki/File:Logo_Tigo.svg"
  },
  {
    "kind": "Marcas",
    "name": "Entel",
    "author": "Entel S.A.",
    "license": "CC0",
    "source": "https://commons.wikimedia.org/wiki/File:Logo_Entel_S.A._Bolivia_2026_nuevo_logo.png"
  }
];
