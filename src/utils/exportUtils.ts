import ExcelJS from 'exceljs';
import type { AppData, DetectionData } from '../types';

export const exportToExcel = async (
  data: AppData,
  options?: {
    activeTable?: 'shifts' | 'flights' | 'batteries' | 'detections';
    filteredData?: any[];
  }
) => {
  const workbook = new ExcelJS.Workbook();
  const activeTable = options?.activeTable;
  const filteredData = options?.filteredData;

  // Helper map to find flight lineName by flightId
  const flightMap = new Map(data.flights.map((f) => [f.id, f.lineName]));

  // Helper to format/style standard tables (fallback)
  const addStandardSheet = (sheetName: string, headers: { header: string; key: string; width: number }[], rows: any[]) => {
    const ws = workbook.addWorksheet(sheetName);
    ws.columns = headers;

    // Header styling
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF217346' }, // Excel green
      };
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 24;

    // Add rows
    rows.forEach((r) => ws.addRow(r));
  };

  // ─── Case 1: Specific Table Export from RecordsExplorer ───
  if (activeTable) {
    if (activeTable === 'detections') {
      const recordsToExport = (filteredData as DetectionData[]) || data.detections;
      const ws = workbook.addWorksheet('Detecciones');

      ws.columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Hora', key: 'hora', width: 12 },
        { header: 'Dispositivo Origen', key: 'dispositivo', width: 20 },
        { header: 'Nombre de la línea', key: 'linea', width: 25 },
        { header: 'Elemento', key: 'elemento', width: 25 },
        { header: 'Anomalía', key: 'anomalia', width: 25 },
        { header: 'Recomendación asociada', key: 'recomendacion', width: 35 },
        { header: 'Criticidad', key: 'criticidad', width: 15 },
        { header: 'Nombre de archivo', key: 'nombre_archivo', width: 20 },
        { header: 'Observaciones', key: 'observaciones', width: 35 },
      ];

      // Header row style
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF217346' },
        };
        cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      headerRow.height = 26;

      recordsToExport.forEach((det) => {
        let fecha = '';
        let hora = '';
        if (det.timestamp) {
          const parts = det.timestamp.trim().split(/\s+/);
          fecha = parts[0] || '';
          hora = parts[1] || '';
        }

        const linea = flightMap.get(det.flightId || '') || '';

        const row = ws.addRow({
          fecha,
          hora,
          dispositivo: det.deviceName || 'Local',
          linea,
          elemento: det.element,
          anomalia: det.anomaly,
          recomendacion: det.recommendation,
          criticidad: det.criticality,
          nombre_archivo: det.fileName,
          observaciones: det.observations,
        });

        // Set alignment for all cells
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });

        // Style the criticality cell with vibrant solid colors
        const cellCrit = row.getCell('criticidad');
        cellCrit.alignment = { vertical: 'middle', horizontal: 'center' };
        
        const valor = (det.criticality || '').toLowerCase();
        let colorHex = '';
        let fontColor = 'FF000000'; // Default black text

        if (valor === 'muy baja') {
          colorHex = 'FF00F2D1'; // Turquesa brillante
        } else if (valor === 'baja') {
          colorHex = 'FF00E676'; // Verde brillante
        } else if (valor === 'media') {
          colorHex = 'FFFFD600'; // Amarillo brillante
        } else if (valor === 'alta') {
          colorHex = 'FFFF9100'; // Naranja brillante
        } else if (valor === 'urgente') {
          colorHex = 'FFFF1744'; // Rojo brillante
          fontColor = 'FFFFFFFF'; // White text for readability on red
        }

        if (colorHex) {
          cellCrit.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colorHex },
          };
          cellCrit.font = {
            name: 'Segoe UI',
            bold: true,
            color: { argb: fontColor },
          };
        }
      });
    } else if (activeTable === 'shifts') {
      addStandardSheet(
        'Jornadas',
        [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Fecha/Hora', key: 'timestamp', width: 22 },
          { header: 'Dispositivo Origen', key: 'deviceName', width: 20 },
          { header: 'Coordinador', key: 'coordinator', width: 25 },
          { header: 'Vehículo', key: 'vehicle', width: 12 },
          { header: 'Dron', key: 'drone', width: 15 },
        ],
        filteredData || data.shifts
      );
    } else if (activeTable === 'flights') {
      addStandardSheet(
        'Vuelos',
        [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Fecha/Hora', key: 'timestamp', width: 22 },
          { header: 'Dispositivo Origen', key: 'deviceName', width: 20 },
          { header: 'Piloto', key: 'pilot', width: 25 },
          { header: 'Línea', key: 'lineName', width: 20 },
          { header: 'Código Auth', key: 'authCode', width: 15 },
          { header: 'Observaciones', key: 'observations', width: 35 },
        ],
        filteredData || data.flights
      );
    } else if (activeTable === 'batteries') {
      addStandardSheet(
        'Baterías',
        [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Fecha/Hora', key: 'timestamp', width: 22 },
          { header: 'Dispositivo Origen', key: 'deviceName', width: 20 },
          { header: 'Piloto', key: 'pilot', width: 25 },
          { header: 'Batería Dron %', key: 'droneBattery', width: 18 },
          { header: 'Batería RC %', key: 'controlBattery', width: 18 },
        ],
        filteredData || data.batteries
      );
    }
  } 
  // ─── Case 2: Full Backup Export (App.tsx) ───
  else {
    // 1. Detecciones (Styled Sheet)
    const wsDetections = workbook.addWorksheet('Detecciones');
    wsDetections.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Hora', key: 'hora', width: 12 },
      { header: 'Dispositivo Origen', key: 'dispositivo', width: 20 },
      { header: 'Nombre de la línea', key: 'linea', width: 25 },
      { header: 'Elemento', key: 'elemento', width: 25 },
      { header: 'Anomalía', key: 'anomalia', width: 25 },
      { header: 'Recomendación asociada', key: 'recomendacion', width: 35 },
      { header: 'Criticidad', key: 'criticidad', width: 15 },
      { header: 'Nombre de archivo', key: 'nombre_archivo', width: 20 },
      { header: 'Observaciones', key: 'observations', width: 35 },
    ];

    const headerRow = wsDetections.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF217346' },
      };
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 26;

    data.detections.forEach((det) => {
      let fecha = '';
      let hora = '';
      if (det.timestamp) {
        const parts = det.timestamp.trim().split(/\s+/);
        fecha = parts[0] || '';
        hora = parts[1] || '';
      }

      const linea = flightMap.get(det.flightId || '') || '';

      const row = wsDetections.addRow({
        fecha,
        hora,
        dispositivo: det.deviceName || 'Local',
        linea,
        elemento: det.element,
        anomalia: det.anomaly,
        recomendacion: det.recommendation,
        criticidad: det.criticality,
        nombre_archivo: det.fileName,
        observations: det.observations,
      });

      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      const cellCrit = row.getCell('criticidad');
      cellCrit.alignment = { vertical: 'middle', horizontal: 'center' };

      const valor = (det.criticality || '').toLowerCase();
      let colorHex = '';
      let fontColor = 'FF000000';

      if (valor === 'muy baja') {
        colorHex = 'FF00F2D1';
      } else if (valor === 'baja') {
        colorHex = 'FF00E676';
      } else if (valor === 'media') {
        colorHex = 'FFFFD600';
      } else if (valor === 'alta') {
        colorHex = 'FFFF9100';
      } else if (valor === 'urgente') {
        colorHex = 'FFFF1744';
        fontColor = 'FFFFFFFF';
      }

      if (colorHex) {
        cellCrit.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorHex },
        };
        cellCrit.font = {
          name: 'Segoe UI',
          bold: true,
          color: { argb: fontColor },
        };
      }
    });

    // 2. Fallbacks for other backup tabs
    if (data.shifts.length > 0) {
      addStandardSheet(
        'Jornadas',
        [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Fecha/Hora', key: 'timestamp', width: 22 },
          { header: 'Dispositivo Origen', key: 'deviceName', width: 20 },
          { header: 'Coordinador', key: 'coordinator', width: 25 },
          { header: 'Vehículo', key: 'vehicle', width: 12 },
          { header: 'Dron', key: 'drone', width: 15 },
        ],
        data.shifts
      );
    }
    if (data.flights.length > 0) {
      addStandardSheet(
        'Vuelos',
        [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Fecha/Hora', key: 'timestamp', width: 22 },
          { header: 'Dispositivo Origen', key: 'deviceName', width: 20 },
          { header: 'Piloto', key: 'pilot', width: 25 },
          { header: 'Línea', key: 'lineName', width: 20 },
          { header: 'Código Auth', key: 'authCode', width: 15 },
          { header: 'Observaciones', key: 'observations', width: 35 },
        ],
        data.flights
      );
    }
    if (data.batteries.length > 0) {
      addStandardSheet(
        'Baterías',
        [
          { header: 'ID', key: 'id', width: 36 },
          { header: 'Fecha/Hora', key: 'timestamp', width: 22 },
          { header: 'Dispositivo Origen', key: 'deviceName', width: 20 },
          { header: 'Piloto', key: 'pilot', width: 25 },
          { header: 'Batería Dron %', key: 'droneBattery', width: 18 },
          { header: 'Batería RC %', key: 'controlBattery', width: 18 },
        ],
        data.batteries
      );
    }
  }

  // Trigger write and download
  const dateStr = new Date().toISOString().split('T')[0];
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Reporte_Campo_${dateStr}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const exportToJSON = (data: AppData) => {
  const dataStr = JSON.stringify(data, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const exportFileDefaultName = `Data_Campo_${new Date().toISOString().split('T')[0]}.json`;
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};
