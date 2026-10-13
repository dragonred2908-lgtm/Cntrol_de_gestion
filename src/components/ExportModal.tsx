import React, { useState } from 'react';
import { FileSpreadsheet, FileText, X, Download } from 'lucide-react';
import { Order, Member } from '../types';
import { exportOrdersToExcel, exportOrdersToPDF } from '../lib/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  members: Member[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  orders,
  members,
}) => {
  const [reportType, setReportType] = useState<'diario' | 'semanal' | 'general'>('general');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('all');
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  // Filter orders according to selection
  let filtered = [...orders];

  if (selectedProfessionalId !== 'all') {
    filtered = filtered.filter((o) => o.assignedTo?.id === selectedProfessionalId);
  }

  if (reportType === 'diario') {
    filtered = filtered.filter((o) => {
      const createdDate = o.createdAt.split('T')[0];
      const updatedDate = o.updatedAt.split('T')[0];
      const dueDate = o.dueDate.split('T')[0];
      return createdDate === targetDate || updatedDate === targetDate || dueDate === targetDate;
    });
  } else if (reportType === 'semanal') {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    filtered = filtered.filter((o) => new Date(o.createdAt) >= oneWeekAgo || new Date(o.updatedAt) >= oneWeekAgo);
  }

  const selectedMember = members.find((m) => m.id === selectedProfessionalId);
  const professionalName = selectedMember ? selectedMember.name : undefined;

  const handleExportExcel = () => {
    const prefix = `Reporte_${reportType.toUpperCase()}_Ordenes`;
    exportOrdersToExcel(filtered, prefix);
  };

  const handleExportPDF = () => {
    exportOrdersToPDF(filtered, members, reportType, professionalName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e16]/80 backdrop-blur-sm p-4 overflow-y-auto font-sans">
      <div className="bg-[#181c24] border border-[#31353e] rounded-xl w-full max-w-lg p-6 shadow-2xl relative text-[#dfe2ee] my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8c909f] hover:text-[#dfe2ee] p-1 rounded-lg hover:bg-[#1c2028] transition cursor-pointer"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#dfe2ee]">
              Exportación de Reportes Detallados
            </h2>
            <p className="text-xs text-[#8c909f]">
              Formatos corporativos en Excel (.xlsx) y PDF de alta calidad
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Period selector */}
          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-1.5 font-mono">
              PERIODO DEL REPORTE
            </label>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setReportType('diario')}
                className={`py-2 px-3 rounded-lg border font-medium transition cursor-pointer ${
                  reportType === 'diario'
                    ? 'bg-[#4d8eff]/15 border-[#4d8eff] text-[#dfe2ee]'
                    : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
                }`}
              >
                📅 Diario
              </button>
              <button
                type="button"
                onClick={() => setReportType('semanal')}
                className={`py-2 px-3 rounded-lg border font-medium transition cursor-pointer ${
                  reportType === 'semanal'
                    ? 'bg-[#4d8eff]/15 border-[#4d8eff] text-[#dfe2ee]'
                    : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
                }`}
              >
                🗓️ Semanal
              </button>
              <button
                type="button"
                onClick={() => setReportType('general')}
                className={`py-2 px-3 rounded-lg border font-medium transition cursor-pointer ${
                  reportType === 'general'
                    ? 'bg-[#4d8eff]/15 border-[#4d8eff] text-[#dfe2ee]'
                    : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
                }`}
              >
                📊 Histórico Total
              </button>
            </div>
          </div>

          {reportType === 'diario' && (
            <div>
              <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
                FECHA DE CONSULTA
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] font-mono cursor-pointer"
              />
            </div>
          )}

          {/* Filter by Professional */}
          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
              FILTRAR POR PROFESIONAL (OPCIONAL)
            </label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-xs text-[#dfe2ee] focus:outline-none focus:border-[#4d8eff] cursor-pointer"
            >
              <option value="all">-- Todos los Profesionales (Reporte Consolidado) --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.telegramUser}) - {m.role}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Preview Counter */}
          <div className="bg-[#0a0e16] rounded-xl p-3 border border-[#31353e]/50 text-xs font-mono">
            <div className="flex justify-between items-center text-[#dfe2ee] mb-1">
              <span>Órdenes encontradas para exportar:</span>
              <span className="px-2 py-0.5 rounded bg-[#4d8eff]/20 text-[#adc6ff] font-bold border border-[#4d8eff]/30">
                {filtered.length} órdenes
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[11px] text-[#8c909f] mt-2 pt-2 border-t border-[#31353e]/40">
              <div>
                Recibidas:{' '}
                <span className="font-semibold text-[#dfe2ee]">
                  {filtered.filter((o) => o.status === 'recibida').length}
                </span>
              </div>
              <div>
                En Cuenta:{' '}
                <span className="font-semibold text-[#60a5fa]">
                  {filtered.filter((o) => o.status === 'en_cuenta').length}
                </span>
              </div>
              <div>
                En Proceso:{' '}
                <span className="font-semibold text-[#fbbf24]">
                  {filtered.filter((o) => o.status === 'en_proceso').length}
                </span>
              </div>
              <div>
                Finalizadas:{' '}
                <span className="font-semibold text-[#34d399]">
                  {filtered.filter((o) => o.status === 'finalizada').length}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
            <button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="py-2 px-4 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              type="button"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={filtered.length === 0}
              className="py-2 px-4 rounded-lg bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
              type="button"
            >
              <FileText className="w-4 h-4" />
              <span>Descargar PDF (.pdf)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
