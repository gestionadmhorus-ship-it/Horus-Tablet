import ExcelJS from 'exceljs';
// @ts-ignore
import qrcode from 'qrcode-generator';
import type { AppData } from '../types';
import { parseLocalTimestampToDate, getChronologicalTime, formatDateDMY, formatTime24h } from './dateUtils';

const splitTimestamp = (timestamp: string): { date: string; time: string } => {
  if (!timestamp) return { date: '', time: '' };
  const d = parseLocalTimestampToDate(timestamp);
  if (!d) {
    const parts = timestamp.trim().split(/\s+/);
    return { date: parts[0] || '', time: parts[1] || '' };
  }
  return {
    date: formatDateDMY(d),
    time: formatTime24h(d)
  };
};

const calculateFlightDuration = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  const startDate = parseLocalTimestampToDate(startStr);
  const endDate = parseLocalTimestampToDate(endStr);
  if (!startDate || !endDate) return 0;
  
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return 0;
  
  return diffMs / (1000 * 60 * 60);
};

const formatDuration = (hours: number): string => {
  if (hours <= 0) return '0 hs';
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  return `${hrs}h ${mins}m (${hours.toFixed(2)} hs)`;
};

export const exportToExcel = async (
  data: AppData,
  options?: {
    dateMode?: 'specific' | 'range';
    specificDate?: string;
    startDate?: string;
    endDate?: string;
  }
) => {
  const workbook = new ExcelJS.Workbook();
  
  // 1. Filter and sort shifts (jornadas)
  let shiftsToExport = [...data.shifts].sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

  if (options?.dateMode) {
    const { dateMode, specificDate, startDate, endDate } = options;
    const specDateObj = specificDate ? new Date(specificDate + 'T00:00:00') : null;
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    shiftsToExport = shiftsToExport.filter(shift => {
      const shiftDate = parseLocalTimestampToDate(shift.timestamp);
      if (!shiftDate) return false;

      if (dateMode === 'specific') {
        if (!specDateObj) return false;
        return shiftDate.getFullYear() === specDateObj.getFullYear() &&
               shiftDate.getMonth() === specDateObj.getMonth() &&
               shiftDate.getDate() === specDateObj.getDate();
      } else {
        if (!start || !end) return false;
        return shiftDate >= start && shiftDate <= end;
      }
    });
  }

  // 2. Create sheets
  const wsKMS = workbook.addWorksheet('Vuelos KMS');
  const wsHS = workbook.addWorksheet('Vuelos HS');

  // Columns widths setup
  wsKMS.columns = [
    { width: 16 }, // Fecha
    { width: 14 }, // Hora
    { width: 24 }, // Elemento
    { width: 28 }, // Anomalía
    { width: 35 }, // Recomendación
    { width: 16 }, // Criticidad
    { width: 18 }, // Acceso a Traza
    { width: 26 }, // Nombre de archivo
  ];

  wsHS.columns = [
    { width: 16 }, // Fecha de inicio
    { width: 14 }, // Hora de inicio
    { width: 26 }, // Solicitado por
    { width: 50 }, // Observaciones de cierre
  ];

  let totalHSDuration = 0;

  // 3. Populate KMS Sheet
  shiftsToExport.forEach((shift) => {
    const kmsFlights = data.flights.filter(f => f.shiftId === shift.id && (f.flightType === 'KMS' || !f.flightType))
                                   .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

    kmsFlights.forEach((flight) => {
      // Row 3+: Detections (filter early to get count for QR payload)
      const detections = data.detections.filter(d => d.flightId === flight.id)
                                        .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

      // Row 1: Title block
      const { date: startDay } = splitTimestamp(flight.timestamp);
      const origenVal = flight.deviceName || shift.deviceName || 'Local';
      const lineVal = flight.lineName || '';
      const stageText = flight.stage ? ` | Etapa: ${flight.stage}` : '';
      const detCount = detections.length;

      // Construct QR code text payload
      const qrText = `Fecha: ${startDay} | Origen: ${origenVal} | Línea: ${lineVal}${stageText} | Total Anomalías: ${detCount}`;

      const titleRow = wsKMS.addRow([
        `Fecha: ${startDay}`,
        '',
        `Origen: ${origenVal}`,
        '',
        `Línea: ${lineVal}${stageText}`,
        '',
        '' // Column G is left empty for the QR code image
      ]);
      
      // Styling Title Row
      titleRow.height = 42; // Taller row height to fit the QR code image nicely
      titleRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: 'FF1B5E20' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F5E9' } // Light green tint
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      // Generate and embed QR Code image
      try {
        const qr = qrcode(0, 'M');
        qr.addData(qrText);
        qr.make();
        const qrDataUrl = qr.createDataURL(4, 1);
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: 'png',
        });
        wsKMS.addImage(imageId, {
          tl: { col: 6, row: titleRow.number - 1, colOff: 10, rowOff: 2 } as any,
          ext: { width: 38, height: 38 },
          editAs: 'oneCell'
        });
      } catch (qrErr) {
        console.error('Error generating QR code in Excel:', qrErr);
      }

      // Row 2: Headers (separated Date and Time)
      const headerRow = wsKMS.addRow([
        'Fecha',
        'Hora',
        'Elemento',
        'Anomalía',
        'Recomendación',
        'Criticidad',
        'Acceso a Traza',
        'Nombre de archivo'
      ]);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF217346' } // Classic Excel Green
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      if (detections.length === 0) {
        const noDataRow = wsKMS.addRow(['Sin detecciones registradas', '', '', '', '', '', '']);
        noDataRow.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', italic: true, color: { argb: 'FF757575' } };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
      } else {
        detections.forEach((det) => {
          const { date: detDate, time: detTime } = splitTimestamp(det.timestamp);
          const row = wsKMS.addRow([
            detDate,
            detTime,
            det.element || '',
            det.anomaly || '',
            det.recommendation || '',
            det.criticality || '',
            det.accessStatus || 'Buena',
            det.fileName || ''
          ]);

          row.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 10 };
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: (colNum === 1 || colNum === 2 || colNum === 6) ? 'center' : 'left' 
            };
          });

          // Style Criticality cell (now at column index 6)
          const cellCrit = row.getCell(6);
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
              fgColor: { argb: colorHex }
            };
            cellCrit.font = { name: 'Segoe UI', bold: true, size: 10, color: { argb: fontColor } };
          }
        });
      }

      // Row Final: Closing timestamp (separated Date and Time)
      const { date: closeDate, time: closeTime } = splitTimestamp(flight.closedTimestamp || '');
      const closingRow = wsKMS.addRow([
        'Fecha finalizada:',
        closeDate || 'No finalizado',
        'Hora finalizada:',
        closeTime || 'No finalizado',
        '', '', ''
      ]);
      closingRow.height = 20;
      closingRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', italic: true, size: 10, color: { argb: 'FF424242' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      // Spacing rows
      wsKMS.addRow([]);
      wsKMS.addRow([]);
    });
  });

  // 4. Populate HS Sheet
  shiftsToExport.forEach((shift) => {
    const hsFlights = data.flights.filter(f => f.shiftId === shift.id && f.flightType === 'HS')
                                  .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

    hsFlights.forEach((flight) => {
      const { date: startDay } = splitTimestamp(flight.timestamp);
      const detallesVal = `${flight.taskTypeAndLocation || 'Sin nombre'}${flight.details ? ` - ${flight.details}` : ''}`;
      
      // Row 1: Title
      const titleRow = wsHS.addRow([
        `Fecha: ${startDay}`,
        '',
        `Detalles: ${detallesVal}`
      ]);
      titleRow.height = 24;
      titleRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: 'FF0D47A1' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE3F2FD' } // Light blue tint
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      // Row 2: Headers (separated Date and Time)
      const headerRow = wsHS.addRow([
        'Fecha de inicio',
        'Hora de inicio',
        'Solicitado por',
        'Observaciones de cierre'
      ]);
      headerRow.height = 24;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF37474F' } // Dark Slate Blue-Gray
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Row 3: Values
      const { date: startDatePart, time: startTimePart } = splitTimestamp(flight.timestamp);
      const obsVal = flight.closingObservations || flight.observations || 'Sin observaciones registradas';
      const valuesRow = wsHS.addRow([
        startDatePart,
        startTimePart,
        flight.requestedBy || '',
        obsVal
      ]);
      valuesRow.height = 22;
      valuesRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: (colNum === 1 || colNum === 2) ? 'center' : 'left' 
        };
      });

      // Row 4: Finalization & Duration (separated Date and Time)
      const { date: endDatePart, time: endTimePart } = splitTimestamp(flight.closedTimestamp || '');
      const durationHours = calculateFlightDuration(flight.timestamp, flight.closedTimestamp || '');
      totalHSDuration += durationHours;
      const durationStr = formatDuration(durationHours);

      const finalRow = wsHS.addRow([
        'Fecha final:',
        endDatePart || 'No finalizado',
        'Hora final:',
        endTimePart || 'No finalizado',
        `Duración: ${durationStr}`
      ]);
      finalRow.height = 22;
      finalRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', italic: true, size: 10, color: { argb: 'FF3E2723' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFEBE9' } // Warm gray-brown tint
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      // Spacing rows
      wsHS.addRow([]);
      wsHS.addRow([]);
    });
  });

  // 5. Total Summation at the end of HS Sheet
  if (totalHSDuration > 0) {
    const sumRow = wsHS.addRow([
      'TOTAL HORAS HS REGISTRADAS:',
      formatDuration(totalHSDuration),
      '',
      ''
    ]);
    sumRow.height = 26;
    sumRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: 'FF1B5E20' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (colNum === 1 || colNum === 2) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } }
        };
      }
    });
  }

  // Convert ArrayBuffer to Base64 in chunks for safe native transfer
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunk = 8192;
    for (let i = 0; i < len; i += chunk) {
      const subArray = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, subArray as any);
    }
    return window.btoa(binary);
  };

  // Write and trigger download
  const dateStr = new Date().toISOString().split('T')[0];
  const buffer = await workbook.xlsx.writeBuffer();

  // Mobile / Capacitor native saving
  if (typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64Data = arrayBufferToBase64(buffer);
      const fileName = `Reporte_Jornada_${dateStr}.xlsx`;
      
      const writeResult = await Filesystem.writeFile({
        path: `Horus_Datos/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });

      await window.customAlert(
        `📊 REPORTE EXCEL GENERADO\n\n` +
        `El archivo se ha guardado con éxito en tu dispositivo.\n\n` +
        `📁 Ubicación: Documentos/Horus_Datos/${fileName}`
      );

      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'Compartir Reporte Excel',
          text: `Reporte de Jornada - ${dateStr}`,
          files: [writeResult.uri],
          dialogTitle: 'Compartir o guardar reporte Excel'
        });
      } catch (shareErr) {
        console.log('Compartir cancelado o no disponible:', shareErr);
      }
    } catch (err: any) {
      await window.customAlert(`❌ Error al guardar el reporte Excel: ${err.message || err}`);
    }
    return;
  }

  // Browser / Electron saving
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Reporte_Jornada_${dateStr}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const exportToJSON = async (data: AppData) => {
  const dataStr = JSON.stringify(data, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Data_Campo_${dateStr}.json`;

  // Mobile / Capacitor native saving
  if (typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const writeResult = await Filesystem.writeFile({
        path: `Horus_Datos/${fileName}`,
        data: dataStr,
        directory: Directory.Documents,
        recursive: true,
        encoding: (await import('@capacitor/filesystem')).Encoding.UTF8
      });

      await window.customAlert(
        `💾 COPIA DE RESPALDO JSON GENERADA\n\n` +
        `El archivo se ha guardado con éxito en tu dispositivo.\n\n` +
        `📁 Ubicación: Documentos/Horus_Datos/${fileName}`
      );

      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'Compartir Copia JSON',
          text: `Copia de Respaldo - ${dateStr}`,
          files: [writeResult.uri],
          dialogTitle: 'Compartir o guardar copia de respaldo JSON'
        });
      } catch (shareErr) {
        console.log('Compartir cancelado o no disponible:', shareErr);
      }
    } catch (err: any) {
      await window.customAlert(`❌ Error al guardar copia JSON: ${err.message || err}`);
    }
    return;
  }

  // Browser / Electron saving
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', fileName);
  linkElement.click();
};
