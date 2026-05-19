import type { ListsData } from '../types';

export const PRELOADED_LISTS: ListsData = {
  coordinators: ["Adelio Gonzalez", "Juan Lucero", "Jorge Sierra", "Tobias Romano", "Guillermo Maschioveccio"],
  pilots: ["Adelio Gonzalez", "Juan Lucero", "Jorge Sierra", "Tobias Romano", "Guillermo Maschioveccio"],
  assistants: ["Adelio Gonzalez", "Juan Lucero", "Jorge Sierra", "Tobias Romano", "Guillermo Maschioveccio"],
  vehicles: ["03", "04", "05"],
  drones: ["M30T-A", "M30T-B"],
  criticalities: ["Muy Baja", "Baja", "Media", "Alta", "Urgente"],
  elements: [
    {
      name: "Atadura",
      anomalies: [
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Oxidación", recommendation: "Reemplazar elemento" },
        { name: "Dañada", recommendation: "Reemplazar elemento" },
        { name: "Floja", recommendation: "Realizar ajuste" },
        { name: "Hebra fina", recommendation: "Reemplazar elemento" },
        { name: "Tipo A", recommendation: "Reemplazar elemento" },
        { name: "Incorrecta", recommendation: "Reemplazar elemento" },
        { name: "Mal colocada", recommendation: "Realizar ajuste" },
        { name: "Cortada", recommendation: "Reemplazar Atadura" }
      ]
    },
    {
      name: "Aislador cerámico",
      anomalies: [
        { name: "Dañado", recommendation: "Reemplazar elemento" },
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Con descarga", recommendation: "Reemplazar elemento" },
        { name: "Desprendido", recommendation: "Reconectar elemento" },
        { name: "Suciedad excesiva", recommendation: "Revisar integridad" },
        { name: "Cabezal de plomo en mal estado", recommendation: "Reemplazar elemento" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Tuerca faltante", recommendation: "Colocar elemento faltante" },
        { name: "Sucio/manchado", recommendation: "Revisar integridad" },
        { name: "Montaje incorrecto", recommendation: "Revisar integridad" },
        { name: "Contaminación", recommendation: "Revisar integridad" },
        { name: "Perno en mal estado", recommendation: "Reemplazar elemento" }
      ]
    },
    {
      name: "Puente de retención",
      anomalies: [
        { name: "Desprendido", recommendation: "Realizar ajuste" },
        { name: "Largo excesivo", recommendation: "Realizar ajuste" },
        { name: "Desconectado", recommendation: "Realizar ajuste" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Cercano a brazo recto", recommendation: "Realizar ajuste" }
      ]
    },
    {
      name: "Perno de aislador",
      anomalies: [
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Bulón desplazado", recommendation: "Realizar ajuste" },
        { name: "Tuerca faltante", recommendation: "Colocar elemento faltante" },
        { name: "Bulón faltante", recommendation: "Colocar elemento faltante" },
        { name: "Inclinado", recommendation: "Revisar integridad" },
        { name: "Dañado", recommendation: "Reemplazar elemento" }
      ]
    },
    {
      name: "Soporte de perno recto",
      anomalies: [
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Bulón desplazado", recommendation: "Realizar ajuste" },
        { name: "Tuerca faltante", recommendation: "Colocar elemento faltante" },
        { name: "Bulón faltante", recommendation: "Colocar elemento faltante" },
        { name: "Inclinado", recommendation: "Revisar integridad" },
        { name: "Dañado", recommendation: "Reemplazar elemento" },
        { name: "Soporte incorrecto", recommendation: "Reemplazar elemento" }
      ]
    },
    {
      name: "Cruceta",
      anomalies: [
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Inclinada", recommendation: "Revisar integridad" },
        { name: "Tuerca faltante", recommendation: "Colocar elemento faltante" },
        { name: "Mal estado", recommendation: "Reemplazar elemento" },
        { name: "Rajada", recommendation: "Revisar integridad" },
        { name: "Nido", recommendation: "Retirar" },
        { name: "Con descarga", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Brazo recto",
      anomalies: [
        { name: "Desprendido", recommendation: "Reconectar elemento" },
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Nido", recommendation: "Retirar" },
        { name: "Elemento extraño", recommendation: "Retirar" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Tuerca faltante", recommendation: "Colocar elemento faltante" },
        { name: "Bulón desplazado", recommendation: "Realizar ajuste" },
        { name: "Bulón desplazado en unión", recommendation: "Realizar ajuste" },
        { name: "Bulón faltante en unión", recommendation: "Colocar elemento faltante" },
        { name: "Bulón sin tuerca en unión", recommendation: "Colocar tuerca faltante" }
      ]
    },
    {
      name: "Poste de eucalipto",
      anomalies: [
        { name: "Rajado", recommendation: "Revisar integridad" },
        { name: "Inclinado", recommendation: "Revisar integridad" },
        { name: "Quebrado", recommendation: "Reemplazar elemento" },
        { name: "Socavación del terreno", recommendation: "Revisar integridad" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Mal estado", recommendation: "Reemplazar elemento" },
        { name: "Empatillado/riendas temporales", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Porta fusibles",
      anomalies: [
        { name: "Desprendido", recommendation: "Reconectar elemento" },
        { name: "Cerámico", recommendation: "Reemplazar elemento" },
        { name: "Fusible desplazado", recommendation: "Realizar ajuste" },
        { name: "Aislador dañado", recommendation: "Reemplazar elemento" },
        { name: "Resorte faltante", recommendation: "Colocar elemento faltante" },
        { name: "Conexión floja", recommendation: "Realizar ajuste" },
        { name: "Resorte desplazado", recommendation: "Realizar ajuste" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" }
      ]
    },
    {
      name: "Reconectador",
      anomalies: [
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Reconectador dañado", recommendation: "Revisar integridad" },
        { name: "Desconectado", recommendation: "Realizar ajuste" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Terminal defectuoso", recommendation: "Reemplazar elemento" }
      ]
    },
    {
      name: "Seccionador",
      anomalies: [
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Indentado defectuoso", recommendation: "Reemplazar elemento" },
        { name: "Cuchilla dañada", recommendation: "Revisar integridad" },
        { name: "Terminal dañado", recommendation: "Revisar integridad" },
        { name: "Aislador dañado", recommendation: "Reemplazar elemento" },
        { name: "Terminal defectuoso", recommendation: "Reemplazar elemento" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Tuerca faltante", recommendation: "Colocar tuerca faltante" }
      ]
    },
    {
      name: "Banco de capacitores",
      anomalies: [
        { name: "Capacitores dañados", recommendation: "Reemplazar elemento" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Presencia de ave", recommendation: "Retirar" }
      ]
    },
    {
      name: "Transformador",
      anomalies: [
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Suciedad excesiva", recommendation: "Revisar integridad" },
        { name: "Transpirado", recommendation: "Revisar integridad" },
        { name: "Desconectado", recommendation: "Reconectar elemento" },
        { name: "Dañado", recommendation: "Reemplazar elemento" },
        { name: "Elemento extraño", recommendation: "Retirar" },
        { name: "Presencia de ave", recommendation: "Retirar" }
      ]
    },
    {
      name: "Aislador polimérico",
      anomalies: [
        { name: "Deteriorado", recommendation: "Reemplazar elemento" },
        { name: "Suciedad excesiva", recommendation: "Revisar integridad" },
        { name: "Dañado", recommendation: "Reemplazar elemento" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Con descarga", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Amortiguador de vibraciones",
      anomalies: [
        { name: "Desprendido", recommendation: "Realizar ajuste" },
        { name: "Oxidado", recommendation: "Revisar integridad" },
        { name: "Desalineado", recommendation: "Realizar ajuste" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Chaveta desplazada", recommendation: "Realizar ajuste" },
        { name: "Chaveta faltante", recommendation: "Colocar chaveta" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" }
      ]
    },
    {
      name: "Antinidos",
      anomalies: [
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Incompleto", recommendation: "Colocar elemento faltante" }
      ]
    },
    {
      name: "Cadena de aisladores",
      anomalies: [
        { name: "Plato faltante", recommendation: "Colocar elemento faltante" },
        { name: "Plato roto", recommendation: "Reemplazar elemento" },
        { name: "Suciedad excesiva", recommendation: "Revisar integridad" },
        { name: "Elemento extraño", recommendation: "Retirar" },
        { name: "Chaveta desplazada", recommendation: "Realizar ajuste" },
        { name: "Chaveta faltante", recommendation: "Colocar elemento faltante" },
        { name: "Tensor con tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Tensor con tuerca ausente", recommendation: "Colocar elemento faltante" },
        { name: "Ojal desgastado", recommendation: "Revisar integridad" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Pesas ausentes", recommendation: "Colocar elemento faltante" },
        { name: "Chaveta incorrecta", recommendation: "Reemplazar chaveta" },
        { name: "Suciedad leve", recommendation: "Realizar limpieza" }
      ]
    },
    {
      name: "Contrapeso",
      anomalies: [
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Desplazado", recommendation: "Realizar ajuste" },
        { name: "Ojal desgastado", recommendation: "Revisar integridad" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Chaveta incorrecta", recommendation: "Reemplazar chaveta" },
        { name: "Chaveta faltante", recommendation: "Colocar chaveta faltante" },
        { name: "Chaveta desplazada", recommendation: "Realizar ajuste" },
        { name: "Desprendido", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Cuna de suspensión",
      anomalies: [
        { name: "Ajuste defectuoso", recommendation: "Realizar ajuste" },
        { name: "Ojal desgastado", recommendation: "Reemplazar elemento" },
        { name: "Tuerca Floja", recommendation: "Realizar ajuste" },
        { name: "Dañada", recommendation: "Revisar integridad" },
        { name: "Desplazada", recommendation: "Realizar ajuste" },
        { name: "Perno desplazado", recommendation: "Realizar ajuste" },
        { name: "Chaveta faltante", recommendation: "Colocar elemento faltante" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Chaveta dañada", recommendation: "Reemplazar elemento" },
        { name: "Chaveta desplazada", recommendation: "Realizar ajuste" }
      ]
    },
    {
      name: "Descargador",
      anomalies: [
        { name: "Suelto", recommendation: "Reconectar elemento" },
        { name: "Dañado", recommendation: "Reemplazar elemento" },
        { name: "Desprendido", recommendation: "Reconectar elemento" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Tuerca floja", recommendation: "Realizar ajuste" }
      ]
    },
    {
      name: "Empalme",
      anomalies: [
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" },
        { name: "Defectuoso", recommendation: "Reemplazar elemento" }
      ]
    },
    {
      name: "Gancho de sujeción",
      anomalies: [
        { name: "Deformado", recommendation: "Revisar integridad" },
        { name: "Oxidado", recommendation: "Reemplazar elemento" },
        { name: "Flojo", recommendation: "Realizar ajuste" },
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Punto caliente", recommendation: "Mitigar y revisar integridad" }
      ]
    },
    {
      name: "Grampa",
      anomalies: [
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Corrosión", recommendation: "Reemplazar elemento" },
        { name: "Floja", recommendation: "Realizar ajuste" }
      ]
    },
    {
      name: "Hilo de guardia",
      anomalies: [
        { name: "Desconectado", recommendation: "Reconectar elemento" },
        { name: "Desprendido", recommendation: "Realizar ajuste" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Chaveta faltante", recommendation: "Colocar elemento faltante" },
        { name: "Chaveta dañada", recommendation: "Reemplazar elemento" },
        { name: "Perno desplazado", recommendation: "Realizar ajuste" },
        { name: "Cuello de cisne dañado", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Ménsula",
      anomalies: [
        { name: "Fracturada", recommendation: "Revisar integridad" },
        { name: "Dañada", recommendation: "Revisar integridad" },
        { name: "Nido", recommendation: "Retirar" }
      ]
    },
    {
      name: "Morseto",
      anomalies: [
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Tuerca faltante", recommendation: "Colocar elemento faltante" },
        { name: "Mal colocado", recommendation: "Realizar ajuste" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Oxidado", recommendation: "Reemplazar elemento" },
        { name: "Incorrecto", recommendation: "Reemplazar elemento" }
      ]
    },
    {
      name: "Morsa de retención",
      anomalies: [
        { name: "Tuerca floja", recommendation: "Realizar ajuste" },
        { name: "Fisurada", recommendation: "Revisar integridad" },
        { name: "Suciedad excesiva", recommendation: "Revisar integridad" },
        { name: "Dañada", recommendation: "Revisar integridad" },
        { name: "Instalación incorrecta", recommendation: "Realizar ajuste" },
        { name: "Chaveta desplazada", recommendation: "Realizar ajuste" },
        { name: "Chaveta incorrecta", recommendation: "Reemplazar elemento" },
        { name: "Chaveta faltante", recommendation: "Colocar elemento faltante" }
      ]
    },
    {
      name: "Rienda",
      anomalies: [
        { name: "Floja", recommendation: "Realizar ajuste" },
        { name: "Cortada", recommendation: "Reemplazar elemento" },
        { name: "Sin aislador", recommendation: "Revisar integridad" },
        { name: "Suelta", recommendation: "Realizar ajuste" },
        { name: "Con descarga", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Estructura de hormigón",
      anomalies: [
        { name: "Tapón faltante", recommendation: "Colocar elemento faltante" },
        { name: "Dañada", recommendation: "Revisar integridad" },
        { name: "Socavada", recommendation: "Revisar integridad" },
        { name: "Sin puesta a tierra", recommendation: "Colocar elemento faltante" }
      ]
    },
    {
      name: "Puesta a tierra",
      anomalies: [
        { name: "Faltante", recommendation: "Colocar elemento faltante" },
        { name: "Dañada", recommendation: "Reemplazar elemento" },
        { name: "Con descarga", recommendation: "Reemplazar elemento" },
        { name: "Desconectada", recommendation: "Reconectar" },
        { name: "Ajuste incorrecto", recommendation: "Realizar ajuste" }
      ]
    },
    {
      name: "Conductor",
      anomalies: [
        { name: "Vano flojo", recommendation: "Colocar separadores" },
        { name: "Con objeto extraño", recommendation: "Retirar objeto extraño" },
        { name: "Hebra suelta", recommendation: "Revisar integridad" },
        { name: "Descarga por contacto entre fases", recommendation: "Colocar separadores" },
        { name: "Mal estado", recommendation: "Revisar integridad" },
        { name: "Cortado", recommendation: "Reemplazar elemento" },
        { name: "Con descarga", recommendation: "Revisar integridad" }
      ]
    },
    {
      name: "Raqueta",
      anomalies: [
        { name: "Chaveta faltante", recommendation: "Colocar chaveta" },
        { name: "Chaveta desplazada", recommendation: "Acomodar chaveta" },
        { name: "Desalineada", recommendation: "Alinear chaveta" },
        { name: "Tocando/cerca de plato", recommendation: "Separar raqueta" },
        { name: "Floja", recommendation: "Realizar ajuste" },
        { name: "Deteriorada", recommendation: "Revisar integridad" },
        { name: "Con descarga", recommendation: "Revisar integridad" },
        { name: "Con suciedad", recommendation: "Realizar limpieza" }
      ]
    },
    {
      name: "Yugo",
      anomalies: [
        { name: "Chaveta faltante", recommendation: "Colocar chaveta" },
        { name: "Chaveta desplazada", recommendation: "Acomodar chaveta" },
        { name: "Con descarga", recommendation: "Revisar integridad" }
      ]
    }
  ]
};
