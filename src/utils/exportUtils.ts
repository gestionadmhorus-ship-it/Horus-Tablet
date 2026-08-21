import ExcelJS from 'exceljs';
// @ts-ignore
import qrcode from 'qrcode-generator';
import type { AppData } from '../types';
import { parseLocalTimestampToDate, getChronologicalTime, formatDateDMY, formatTime24h } from './dateUtils';

export interface ExcelExportOptions {
  dateMode?: 'specific' | 'range';
  specificDate?: string;
  startDate?: string;
  endDate?: string;
  client?: string;
  delivery?: 'download' | 'share';
  scope?: {
    table: 'shifts' | 'flights' | 'detections';
    keys: string[];
  };
}

export interface ExcelExportContext {
  period: string;
  clients: string;
  lines: string;
  recordCount: number;
  fileName: string;
  subject: string;
  body: string;
}

const resolveShiftsToExport = (data: AppData, options?: ExcelExportOptions): any[] => {
  let shifts = [...data.shifts]
    .filter(shift => !shift.isDeleted)
    .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

  if (options?.dateMode) {
    const specDateObj = options.specificDate ? new Date(options.specificDate + 'T00:00:00') : null;
    const start = options.startDate ? new Date(options.startDate + 'T00:00:00') : null;
    const end = options.endDate ? new Date(options.endDate + 'T23:59:59') : null;
    shifts = shifts.filter(shift => {
      const shiftDate = parseLocalTimestampToDate(shift.timestamp);
      if (!shiftDate) return false;
      if (options.dateMode === 'specific' && specDateObj) {
        return shiftDate.getFullYear() === specDateObj.getFullYear()
          && shiftDate.getMonth() === specDateObj.getMonth()
          && shiftDate.getDate() === specDateObj.getDate();
      }
      return options.dateMode !== 'range' || !start || !end || (shiftDate >= start && shiftDate <= end);
    });
  }

  if (options?.client) {
    shifts = shifts.filter(shift => options.client === '__legacy_without_client__'
      ? !shift.client?.trim()
      : shift.client?.trim() === options.client);
  }

  if (options?.scope?.table === 'shifts') {
    const keys = new Set(options.scope.keys);
    shifts = shifts.filter(shift => keys.has(shift.recordUid || shift.id));
  }

  if (shifts.length === 0 && data.flights.some(flight => !flight.isDeleted) && !options?.client) {
    shifts = [{
      id: 'fallback-shift',
      timestamp: data.flights.find(flight => !flight.isDeleted)?.timestamp || data.detections.find(detection => !detection.isDeleted)?.timestamp || '',
      coordinator: 'Sistema',
      assistants: [],
      vehicle: '',
      drone: '',
      status: 'closed'
    }];
  }

  return shifts;
};

const belongsToShift = (flight: any, shift: any): boolean => shift.id === 'fallback-shift'
  || (shift.recordUid ? flight.shiftRecordUid === shift.recordUid : flight.shiftId === shift.id);

const recordKey = (record: any): string => record.recordUid || record.id;

const resolveFlightsToExport = (data: AppData, shifts: any[], options?: ExcelExportOptions): any[] => {
  let flights = data.flights.filter(flight => !flight.isDeleted && shifts.some(shift => belongsToShift(flight, shift)));
  if (options?.scope?.table === 'flights') {
    const keys = new Set(options.scope.keys);
    flights = flights.filter(flight => keys.has(recordKey(flight)));
  } else if (options?.scope?.table === 'detections') {
    const detectionKeys = new Set(options.scope.keys);
    const selectedDetections = data.detections.filter(detection => detectionKeys.has(recordKey(detection)));
    const flightKeys = new Set(selectedDetections.flatMap(detection => [detection.flightRecordUid, detection.flightId].filter(Boolean)));
    flights = flights.filter(flight => flightKeys.has(flight.recordUid) || flightKeys.has(flight.id));
  }
  return flights;
};

const isTimestampInExportRange = (timestamp: string, options?: ExcelExportOptions): boolean => {
  if (!options?.dateMode) return true;
  const date = parseLocalTimestampToDate(timestamp);
  if (!date) return true;
  const specific = options.specificDate ? new Date(options.specificDate + 'T00:00:00') : null;
  const start = options.startDate ? new Date(options.startDate + 'T00:00:00') : null;
  const end = options.endDate ? new Date(options.endDate + 'T23:59:59') : null;
  if (options.dateMode === 'specific' && specific) {
    return date.getFullYear() === specific.getFullYear()
      && date.getMonth() === specific.getMonth()
      && date.getDate() === specific.getDate();
  }
  return options.dateMode !== 'range' || !start || !end || (date >= start && date <= end);
};

const resolveDetectionsToExport = (data: AppData, flights: any[], options?: ExcelExportOptions): any[] => {
  let detections = data.detections.filter(detection => !detection.isDeleted && isTimestampInExportRange(detection.timestamp, options));
  if (options?.scope?.table === 'detections') {
    const keys = new Set(options.scope.keys);
    return detections.filter(detection => keys.has(recordKey(detection)));
  }
  if (options?.client || options?.scope) {
    const flightKeys = new Set(flights.flatMap(flight => [flight.recordUid, flight.id].filter(Boolean)));
    detections = detections.filter(detection => flightKeys.has(detection.flightRecordUid) || flightKeys.has(detection.flightId));
  }
  return detections;
};

const sanitizeFilePart = (value: string): string => value
  .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

export const getExcelExportContext = (data: AppData, options?: ExcelExportOptions): ExcelExportContext => {
  const shifts = resolveShiftsToExport(data, options);
  const flights = resolveFlightsToExport(data, shifts, options);
  const detections = resolveDetectionsToExport(data, flights, options);
  const contextShifts = options?.scope && options.scope.table !== 'shifts'
    ? shifts.filter(shift => flights.some(flight => belongsToShift(flight, shift)))
    : shifts;

  const dates = [...contextShifts.map(shift => shift.timestamp), ...flights.map(flight => flight.timestamp), ...detections.map(detection => detection.timestamp)]
    .map(parseLocalTimestampToDate)
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime());
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const period = !firstDate ? 'Sin fecha'
    : firstDate.toDateString() === lastDate.toDateString()
      ? formatDateDMY(firstDate).replaceAll('/', '-')
      : `${formatDateDMY(firstDate).replaceAll('/', '-')} al ${formatDateDMY(lastDate).replaceAll('/', '-')}`;

  const clientValues = Array.from(new Set(contextShifts
    .filter(shift => shift.id !== 'fallback-shift')
    .map(shift => shift.client?.trim() || 'Sin cliente histórico')));
  const lineValues = Array.from(new Set(flights
    .filter(flight => flight.flightType === 'KMS' || !flight.flightType)
    .map(flight => flight.lineName?.trim())
    .filter(Boolean))) as string[];
  const clients = clientValues.length > 1 ? 'Varios Clientes' : (clientValues[0] || 'Sin cliente histórico');
  const lines = lineValues.length > 1 ? 'Varias Lineas' : (lineValues[0] || '');
  const descriptor = clients === 'Varios Clientes' ? clients : [clients, lines].filter(Boolean).join(' ');
  const fileName = `${sanitizeFilePart(period)} - ${sanitizeFilePart(descriptor)}.xlsx`;
  const recordCount = flights.length + detections.length;
  const subject = `Hermes - ${descriptor} - ${period}`;
  const body = `Se adjuntan los registros correspondientes a los filtros seleccionados en Hermes 2.0.\n\nPeríodo: ${period}\nCliente(s): ${clients}\nLínea(s): ${lines || 'No aplica'}\nRegistros: ${recordCount}`;

  return { period, clients, lines, recordCount, fileName, subject, body };
};

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
  options?: ExcelExportOptions
) => {
  const exportContext = getExcelExportContext(data, options);
  if (exportContext.recordCount === 0) {
    await window.customAlert('No hay registros para exportar con los filtros seleccionados.');
    return;
  }
  const workbook = new ExcelJS.Workbook();
  
  // 1. Filter and sort shifts (jornadas)
  const shiftsToExport = resolveShiftsToExport(data, options);
  const flightsToExport = resolveFlightsToExport(data, shiftsToExport, options);

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
    { width: 26 }, // Nombre de archivo
    { width: 18 }, // Acceso a Traza
    { width: 40 }, // Observaciones (Siguiente a Acceso a Traza)
    { width: 24 }, // Piloto
    { width: 24 }, // Código de autorización
  ];

  wsHS.columns = [
    { width: 16 }, // Fecha de inicio
    { width: 14 }, // Hora de inicio
    { width: 26 }, // Solicitado por
    { width: 50 }, // Observaciones de cierre
  ];

  // Helper function to render a flight block in the KMS sheet
  const renderKMSFlightBlock = (
    sheet: ExcelJS.Worksheet,
    wb: ExcelJS.Workbook,
    flight: any,
    shift: any,
    detectionsList: any[]
  ) => {
    const { date: startDay } = splitTimestamp(flight.timestamp || shift.timestamp || '');
    const origenVal = flight.deviceName || shift.deviceName || 'Local';
    const clientVal = shift.client || 'Sin cliente histórico';
    const lineVal = flight.lineName || 'Detecciones Tácticas';
    const stageText = flight.stage ? ` | Etapa: ${flight.stage}` : '';
    const detCount = detectionsList.length;

    // Extract unique access statuses for QR payload
    const accessSummary = Array.from(new Set(detectionsList.map(d => d.accessStatus || 'Buena'))).join('/') || 'Buena';

    // Construct QR code text payload including Acceso a Traza
    const qrText = `Fecha: ${startDay} | Origen: ${origenVal} | Línea: ${lineVal}${stageText} | Total Anomalías: ${detCount} | Acceso: ${accessSummary}`;

    const titleRow = sheet.addRow([
      `Fecha: ${startDay}`,
      '',
      `Origen: ${origenVal}`,
      '',
      `Línea: ${clientVal} ${lineVal}${stageText}`,
      '',
      '',
      '',
      '', // Column I (index 8) left empty for QR
      '',
      ''
    ]);
    
    // Styling Title Row
    titleRow.height = 42;
    titleRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: 'FF1B5E20' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
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
      const imageId = wb.addImage({
        base64: base64Data,
        extension: 'png',
      });
      sheet.addImage(imageId, {
        tl: { col: 8, row: titleRow.number - 1, colOff: 10, rowOff: 2 } as any,
        ext: { width: 38, height: 38 },
        editAs: 'oneCell'
      });
    } catch (qrErr) {
      console.error('Error generating QR code in Excel:', qrErr);
    }

    // Row 2: Headers (11 columns)
    const headerRow = sheet.addRow([
      'Fecha',
      'Hora',
      'Elemento',
      'Anomalía',
      'Recomendación',
      'Criticidad',
      'Nombre de archivo',
      'Acceso a Traza',
      'Observaciones',
      'Piloto',
      'Código de autorización'
    ]);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF217346' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    if (detectionsList.length === 0) {
      const noDataRow = sheet.addRow([
        'Sin detecciones registradas', '', '', '', '', '', '', '', '',
        flight.pilot || '',
        flight.authCode || ''
      ]);
      noDataRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', italic: true, color: { argb: 'FF757575' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    } else {
      detectionsList.forEach((det) => {
        const { date: detDate, time: detTime } = splitTimestamp(det.timestamp);
        const row = sheet.addRow([
          detDate,
          detTime,
          det.element || '',
          det.anomaly || '',
          det.recommendation || '',
          det.criticality || '',
          det.fileName || '',
          det.accessStatus || 'Buena',
          det.observations || '',
          flight.pilot || '',
          flight.authCode || ''
        ]);

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 10 };
          cell.alignment = { 
            vertical: 'middle', 
            horizontal: (colNum === 1 || colNum === 2 || colNum === 6 || colNum === 8) ? 'center' : 'left' 
          };
        });

        // Style Criticality cell (column index 6)
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

        // Style Access Status cell (column index 8)
        const cellAcc = row.getCell(8);
        const accVal = (det.accessStatus || 'Buena').toLowerCase();
        let accBg = 'FFE8F5E9';
        let accFont = 'FF1B5E20';

        if (accVal === 'regular') {
          accBg = 'FFFFF8E1';
          accFont = 'FFE65100';
        } else if (accVal === 'mala') {
          accBg = 'FFFFEBEE';
          accFont = 'FFC62828';
        }

        cellAcc.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: accBg }
        };
        cellAcc.font = { name: 'Segoe UI', bold: true, size: 10, color: { argb: accFont } };
      });
    }

    // Row Final: Closing timestamp
    const { date: closeDate, time: closeTime } = splitTimestamp(flight.closedTimestamp || '');
    const closingRow = sheet.addRow([
      'Fecha finalizada:',
      closeDate || 'No finalizado',
      'Hora finalizada:',
      closeTime || 'No finalizado',
      '', '', '', '', '', '', ''
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

    sheet.addRow([]);
    sheet.addRow([]);
  };

  const allDetectionsToExport = resolveDetectionsToExport(data, flightsToExport, options);
  const processedDetectionIds = new Set<string>();

  // 3. Populate KMS Sheet by iterating shifts & flights
  shiftsToExport.forEach((shift) => {
    const kmsFlights = flightsToExport.filter(f => belongsToShift(f, shift) && (f.flightType === 'KMS' || !f.flightType))
                                   .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

    kmsFlights.forEach((flight) => {
      const detections = allDetectionsToExport.filter(d => flight.recordUid ? d.flightRecordUid === flight.recordUid : d.flightId === flight.id)
                                              .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));
      detections.forEach(d => processedDetectionIds.add(d.id));
      renderKMSFlightBlock(wsKMS, workbook, flight, shift, detections);
    });
  });

  // Catch any remaining detections that were not linked to a flight or shift (Fail-safe)
  const remainingDetections = allDetectionsToExport.filter(d => !processedDetectionIds.has(d.id));
  if (remainingDetections.length > 0) {
    const firstDet = remainingDetections[0];
    const virtualFlight = {
      id: 'virtual-flight',
      timestamp: firstDet.timestamp,
      deviceName: firstDet.deviceName || 'Local',
      lineName: 'Detecciones Generales',
      flightType: 'KMS',
      status: 'closed'
    };
    const virtualShift = {
      id: 'virtual-shift',
      timestamp: firstDet.timestamp,
      deviceName: firstDet.deviceName || 'Local',
      coordinator: 'Sistema',
      status: 'closed'
    };
    renderKMSFlightBlock(wsKMS, workbook, virtualFlight, virtualShift, remainingDetections);
  }

  // 4. Populate HS Sheet
  let totalHSDuration = 0;
  shiftsToExport.forEach((shift) => {
    const hsFlights = flightsToExport.filter(f => belongsToShift(f, shift) && f.flightType === 'HS')
                                  .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

    hsFlights.forEach((flight) => {
      const { date: startDay } = splitTimestamp(flight.timestamp);
      const detallesVal = `${flight.taskTypeAndLocation || 'Sin nombre'}${flight.details ? ` - ${flight.details}` : ''}`;
      
      // Row 1: Title
      const titleRow = wsHS.addRow([
        `Fecha: ${startDay}`,
        '',
        `Cliente: ${shift.client || 'Sin cliente histórico'} | Detalles: ${detallesVal}`
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

  // Write once; every delivery path reuses this exact workbook and contextual name.
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = exportContext.fileName;

  // Mobile / Capacitor native saving
  if (typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64Data = arrayBufferToBase64(buffer);
      const isShare = options?.delivery === 'share';
      const writeResult = await Filesystem.writeFile({
        path: `${isShare ? 'Horus_Exportaciones' : 'Horus_Datos'}/${fileName}`,
        data: base64Data,
        directory: isShare ? Directory.Cache : Directory.Documents,
        recursive: true
      });

      if (isShare) {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: exportContext.subject,
          text: exportContext.body,
          files: [writeResult.uri],
          dialogTitle: 'Preparar correo o compartir reporte'
        });
      } else {
        await window.customAlert(
          `📊 REPORTE EXCEL GENERADO\n\n` +
          `El archivo se ha guardado con éxito en tu dispositivo.\n\n` +
          `📁 Ubicación: Documentos/Horus_Datos/${fileName}`
        );
      }
    } catch (err: any) {
      await window.customAlert(`❌ Error al preparar el reporte Excel: ${err.message || err}`);
    }
    return;
  }

  // Browser / Electron saving
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const file = new File([blob], fileName, { type: blob.type });
  const shareData = { title: exportContext.subject, text: exportContext.body, files: [file] };
  if (options?.delivery === 'share' && navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.warn('No se pudo abrir el compartidor con adjunto:', error);
    }
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);

  if (options?.delivery === 'share') {
    await window.customAlert(
      `El archivo “${fileName}” se descargó, pero esta plataforma no permite adjuntarlo automáticamente de forma segura.\n\n` +
      `Asunto sugerido: ${exportContext.subject}\n\n${exportContext.body}\n\n` +
      `Adjunta manualmente el archivo descargado en tu cliente de correo.`
    );
  }
};

export const exportBatteriesToExcel = async (
  data: AppData,
  options?: {
    dateMode?: 'specific' | 'range';
    specificDate?: string;
    startDate?: string;
    endDate?: string;
    client?: string;
  }
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Baterías');
  const flightMap = new Map(data.flights.filter(flight => !flight.isDeleted).map(flight => [flight.recordUid, flight]));
  const shiftMap = new Map(data.shifts.filter(shift => !shift.isDeleted).map(shift => [shift.recordUid, shift]));

  const specDate = options?.specificDate ? new Date(options.specificDate + 'T00:00:00') : null;
  const start = options?.startDate ? new Date(options.startDate + 'T00:00:00') : null;
  const end = options?.endDate ? new Date(options.endDate + 'T23:59:59') : null;

  const batteries = data.batteries
    .filter(battery => {
      if (battery.isDeleted) return false;
      if (options?.client) {
        const flight = battery.flightRecordUid ? flightMap.get(battery.flightRecordUid) : undefined;
        const shift = flight?.shiftRecordUid ? shiftMap.get(flight.shiftRecordUid) : undefined;
        if (options.client === '__legacy_without_client__' ? !!shift?.client?.trim() : shift?.client !== options.client) return false;
      }
      if (!options?.dateMode) return true;

      const batteryDate = parseLocalTimestampToDate(battery.timestamp);
      if (!batteryDate) return false;

      if (options.dateMode === 'specific') {
        return !!specDate
          && batteryDate.getFullYear() === specDate.getFullYear()
          && batteryDate.getMonth() === specDate.getMonth()
          && batteryDate.getDate() === specDate.getDate();
      }

      return !!start && !!end && batteryDate >= start && batteryDate <= end;
    })
    .sort((a, b) => getChronologicalTime(a.timestamp) - getChronologicalTime(b.timestamp));

  worksheet.columns = [
    { header: 'Jornada', key: 'shift', width: 24 },
    { header: 'Fecha de jornada', key: 'shiftDate', width: 18 },
    { header: 'Vuelo', key: 'flight', width: 30 },
    { header: 'Tipo de vuelo', key: 'flightType', width: 16 },
    { header: 'Dron', key: 'drone', width: 18 },
    { header: 'Piloto', key: 'pilot', width: 24 },
    { header: 'Batería dron', key: 'droneBattery', width: 18 },
    { header: 'Batería control', key: 'controlBattery', width: 18 },
    { header: 'Fecha del registro', key: 'recordDate', width: 20 },
    { header: 'Hora del registro', key: 'recordTime', width: 18 }
  ];

  batteries.forEach(battery => {
    const flight = battery.flightRecordUid ? flightMap.get(battery.flightRecordUid) : undefined;
    const shift = flight?.shiftRecordUid ? shiftMap.get(flight.shiftRecordUid) : undefined;
    const shiftTimestamp = shift ? splitTimestamp(shift.timestamp) : { date: '—', time: '' };
    const batteryTimestamp = splitTimestamp(battery.timestamp);
    const flightName = flight
      ? (flight.flightType === 'HS' ? flight.taskTypeAndLocation : flight.lineName) || flight.id
      : battery.flightId || '—';

    worksheet.addRow({
      shift: shift?.id || '—',
      shiftDate: shiftTimestamp.date || '—',
      flight: flightName,
      flightType: flight ? (flight.flightType || 'KMS') : '—',
      drone: shift?.drone || '—',
      pilot: flight?.pilot || battery.pilot || '—',
      droneBattery: battery.droneBatteryName || '—',
      controlBattery: battery.controlBatteryName || '—',
      recordDate: batteryTimestamp.date || '—',
      recordTime: batteryTimestamp.time || '—'
    });
  });

  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'J1' };

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Reporte_Baterias_${dateStr}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  if (typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.byteLength; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
      }

      const writeResult = await Filesystem.writeFile({
        path: `Horus_Datos/${fileName}`,
        data: window.btoa(binary),
        directory: Directory.Documents,
        recursive: true
      });

      await window.customAlert(
        `📊 REPORTE DE BATERÍAS GENERADO\n\n` +
        `El archivo se ha guardado con éxito en tu dispositivo.\n\n` +
        `📁 Ubicación: Documentos/Horus_Datos/${fileName}`
      );

      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'Compartir Reporte de Baterías',
          text: `Reporte de Baterías - ${dateStr}`,
          files: [writeResult.uri],
          dialogTitle: 'Compartir o guardar reporte de baterías'
        });
      } catch (shareErr) {
        console.log('Compartir cancelado o no disponible:', shareErr);
      }
    } catch (err: any) {
      await window.customAlert(`❌ Error al guardar el reporte de baterías: ${err.message || err}`);
    }
    return;
  }

  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
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
