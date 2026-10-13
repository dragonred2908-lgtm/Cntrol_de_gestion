import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, Member } from '../types';

export function exportOrdersToExcel(
  orders: Order[],
  title: string = 'Reporte_de_Ordenes_Control_Gestion'
) {
  const data = orders.map((o) => ({
    'ID Orden': o.id,
    'Título de Orden': o.title,
    'Descripción': o.description,
    'Origen': o.origin === 'telegram' ? 'Bot Telegram' : 'Panel Web',
    'Estado': formatStatus(o.status),
    'Prioridad': o.priority.toUpperCase(),
    'Profesional Asignado': o.assignedTo ? o.assignedTo.name : 'Sin Asignar',
    'Usuario Telegram': o.assignedTo ? o.assignedTo.telegramUser : '-',
    'Departamento / Área': o.department || 'General',
    'Fecha Creación': new Date(o.createdAt).toLocaleString('es-ES'),
    'Fecha Límite': new Date(o.dueDate).toLocaleString('es-ES'),
    'Fecha Finalización': o.completedAt ? new Date(o.completedAt).toLocaleString('es-ES') : 'Pendiente',
    'Recordatorios Enviados': o.remindersCount || 0,
    'Último Recordatorio': o.lastReminderAt ? new Date(o.lastReminderAt).toLocaleString('es-ES') : '-',
    'Creado Por': o.createdBy,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto column width
  const maxProps = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(key.length + 3, 16),
  }));
  worksheet['!cols'] = maxProps;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Órdenes de Gestión');

  // Generate and download
  const filename = `${title}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportOrdersToPDF(
  orders: Order[],
  members: Member[],
  reportType: 'diario' | 'semanal' | 'general' = 'general',
  selectedProfessionalName?: string
) {
  const doc = new jsPDF('landscape', 'pt', 'a4');

  const primaryColor = [30, 41, 59]; // slate-800
  const accentColor = [37, 99, 235]; // blue-600

  // Header Title & Branding
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 842, 60, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SISTEMA DE CONTROL DE GESTIÓN Y ASIGNACIÓN DE ÓRDENES', 30, 36);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Integración Telegram Bot & Seguimiento Operativo', 600, 36);

  // Report details subtitle
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');

  let reportTitle = 'Reporte General de Órdenes';
  if (reportType === 'diario') reportTitle = 'Reporte Diario de Gestión de Órdenes';
  if (reportType === 'semanal') reportTitle = 'Reporte Semanal de Rendimiento y Órdenes';
  if (selectedProfessionalName) reportTitle += ` - ${selectedProfessionalName}`;

  doc.text(reportTitle, 30, 85);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')} | Total Registros: ${orders.length}`, 30, 100);

  // Summary counters
  const total = orders.length;
  const enCuenta = orders.filter((o) => o.status === 'en_cuenta').length;
  const enProceso = orders.filter((o) => o.status === 'en_proceso').length;
  const finalizadas = orders.filter((o) => o.status === 'finalizada').length;
  const recibidas = orders.filter((o) => o.status === 'recibida').length;
  const completionRate = total > 0 ? Math.round((finalizadas / total) * 100) : 0;

  // Mini summary box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(30, 112, 782, 38, 4, 4, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Resumen:  Total: ${total}   |   📥 Recibidas: ${recibidas}   |   👀 En Cuenta: ${enCuenta}   |   ⏳ En Proceso: ${enProceso}   |   ✅ Finalizadas: ${finalizadas}   |   Tasa Cumplimiento: ${completionRate}%`,
    40,
    134
  );

  // Table rows
  const tableRows = orders.map((o) => [
    o.id,
    o.title.length > 35 ? o.title.substring(0, 32) + '...' : o.title,
    o.assignedTo ? o.assignedTo.name : 'Sin Asignar',
    o.assignedTo ? o.assignedTo.telegramUser : '-',
    formatStatus(o.status),
    o.priority.toUpperCase(),
    new Date(o.createdAt).toLocaleDateString('es-ES'),
    new Date(o.dueDate).toLocaleDateString('es-ES'),
    o.completedAt ? new Date(o.completedAt).toLocaleDateString('es-ES') : 'Pendiente',
    String(o.remindersCount || 0),
  ]);

  autoTable(doc, {
    head: [
      [
        'ID',
        'Título de Orden',
        'Profesional',
        'Telegram',
        'Estado',
        'Prioridad',
        'Creada',
        'Límite',
        'Cierre',
        'Rec.',
      ],
    ],
    body: tableRows,
    startY: 160,
    margin: { left: 30, right: 30 },
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  // Footer page numbering
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${pageCount} - Confidencial para Administración y Desarrollo`, 30, 575);
  }

  const filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

function formatStatus(status: string): string {
  switch (status) {
    case 'recibida':
      return 'Recibida';
    case 'en_cuenta':
      return 'En Cuenta';
    case 'en_proceso':
      return 'En Proceso';
    case 'finalizada':
      return 'Finalizada';
    default:
      return status;
  }
}
