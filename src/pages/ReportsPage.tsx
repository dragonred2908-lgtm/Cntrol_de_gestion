import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from 'lucide-react';
import { useWorkspace } from '../app/workspace';
import { api, KpiAnalysis } from '../lib/api';
import { hasPermission } from '../lib/rbacConfig';
import { Badge, Button, Card, Field, Progress, SectionHeader, Select, Textarea } from '../ui/kit';
import { computeMemberLoad, computeStats, formatDate } from '../lib/helpers';
import { exportOrdersToExcel, exportOrdersToPDF } from '../lib/exportUtils';
import { Order } from '../types';

type Period = 'all' | '7d' | '30d' | 'completed' | 'pending';

export function ReportsPage() {
  const { orders, members, pushToast, session } = useWorkspace();
  const canExport = hasPermission(session.role, 'export_reports');
  const canUseAi = session.role === 'admin' || session.role === 'developer';
  const [period, setPeriod] = useState<Period>('all');
  const [memberId, setMemberId] = useState('all');
  const [goals, setGoals] = useState('');
  const [analysis, setAnalysis] = useState<KpiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    return orders.filter((order) => {
      if (memberId !== 'all' && order.assignedTo?.id !== memberId) return false;
      if (period === 'completed' && order.status !== 'finalizada') return false;
      if (period === 'pending' && order.status === 'finalizada') return false;
      if (period === '7d' || period === '30d') {
        const days = period === '7d' ? 7 : 30;
        const created = new Date(order.createdAt).getTime();
        if (Number.isNaN(created) || now - created > days * 24 * 3600 * 1000) return false;
      }
      return true;
    });
  }, [orders, period, memberId]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const loads = useMemo(() => computeMemberLoad(filtered), [filtered]);
  const selectedMember = members.find((member) => member.id === memberId);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await api.ai.analyzeKpis(goals.trim() || undefined);
      setAnalysis(result);
      pushToast('Análisis de KPIs generado.', 'success');
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'No se pudo generar el análisis con IA.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const exportExcel = () => {
    if (filtered.length === 0) {
      pushToast('No hay órdenes para exportar con los filtros actuales.', 'warning');
      return;
    }
    exportOrdersToExcel(filtered as Order[], 'Reporte_Control_Gestion');
    pushToast('Planilla Excel generada.', 'success');
  };

  const exportPdf = () => {
    if (filtered.length === 0) {
      pushToast('No hay órdenes para exportar con los filtros actuales.', 'warning');
      return;
    }
    const reportType = period === '7d' ? 'semanal' : period === '30d' ? 'semanal' : 'general';
    exportOrdersToPDF(filtered as Order[], members, reportType, selectedMember?.name);
    pushToast('Reporte PDF generado.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Inteligencia operativa</div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--txt)] mt-1">Reportes y análisis</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">
            Exportá el estado de gestión y obtené un diagnóstico asistido por IA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <>
              <Button variant="outline" icon={FileSpreadsheet} onClick={exportExcel}>
                Excel
              </Button>
              <Button variant="outline" icon={FileText} onClick={exportPdf}>
                PDF
              </Button>
            </>
          ) : (
            <Badge tone="neutral">Solo lectura</Badge>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Período">
            <Select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-9">
              <option value="all">Todo el historial</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="pending">Solo pendientes</option>
              <option value="completed">Solo finalizadas</option>
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="h-9">
              <option value="all">Todo el equipo</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 h-9 flex items-center justify-between text-[12px]">
              <span className="text-[var(--txt-2)]">Registros incluidos</span>
              <span className="mono text-[var(--txt)]">{filtered.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Órdenes', value: stats.total, hint: `${stats.pending} abiertas`, icon: BarChart3, tone: 'blue' },
          { label: 'Finalizadas', value: stats.completed, hint: `${stats.completionRate}% del total`, icon: TrendingUp, tone: 'green' },
          { label: 'Vencidas', value: stats.overdue, hint: 'fuera de plazo', icon: Loader2, tone: stats.overdue ? 'red' : 'green' },
          { label: 'Media de cierre', value: `${stats.avgCompletionHours}h`, hint: 'desde creación a cierre', icon: Users, tone: 'violet' },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <div className="eyebrow">{item.label}</div>
            <div className="mono text-[24px] font-semibold text-[var(--txt)] mt-2 leading-none">{item.value}</div>
            <div className="text-[11px] text-[var(--txt-3)] mt-1.5">{item.hint}</div>
            <div className="mt-2">
              <Progress
                value={item.label === 'Finalizadas' ? stats.completionRate : item.label === 'Vencidas' ? (stats.total ? (stats.overdue / stats.total) * 100 : 0) : 100}
                tone={item.tone === 'red' ? 'red' : item.tone === 'green' ? 'green' : 'blue'}
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          {/* Tabla resumen */}
          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-[var(--line)]">
              <SectionHeader
                eyebrow="Detalle"
                title="Muestra de órdenes del reporte"
                subtitle="Vista previa de los primeros 10 registros incluidos."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Estado</th>
                    <th className="hidden sm:table-cell">Responsable</th>
                    <th className="hidden md:table-cell">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 10).map((order) => (
                    <tr key={order.id} className="cursor-default">
                      <td>
                        <div className="mono text-[10px] text-[var(--txt-3)]">#{order.id}</div>
                        <div className="text-[12.5px] text-[var(--txt)] truncate max-w-[260px]">{order.title}</div>
                      </td>
                      <td>
                        <Badge tone={order.status === 'finalizada' ? 'green' : order.status === 'en_proceso' ? 'violet' : order.status === 'en_cuenta' ? 'amber' : 'blue'}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell text-[12px] text-[var(--txt-2)]">{order.assignedTo?.name || 'Sin asignar'}</td>
                      <td className="hidden md:table-cell mono text-[11px] text-[var(--txt-3)]">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-[12px] text-[var(--txt-3)] py-8">
                        No hay registros con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Performance equipo */}
          <Card className="p-4">
            <SectionHeader eyebrow="Desempeño" title="Rendimiento por integrante" subtitle="Órdenes abiertas, cerradas y vencidas en el período." />
            <div className="mt-3 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Integrante</th>
                    <th className="text-right">Abiertas</th>
                    <th className="text-right hidden sm:table-cell">Cerradas</th>
                    <th className="text-right">Vencidas</th>
                    <th className="hidden md:table-cell w-[160px]">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.map((entry) => (
                    <tr key={entry.memberId} className="cursor-default">
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                          <span className="text-[12.5px] text-[var(--txt)]">{entry.name}</span>
                        </div>
                      </td>
                      <td className="text-right mono text-[12px]">{entry.open}</td>
                      <td className="text-right mono text-[12px] hidden sm:table-cell">{entry.completed}</td>
                      <td className="text-right mono text-[12px]" style={{ color: entry.overdue ? '#ff93a0' : undefined }}>{entry.overdue}</td>
                      <td className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress value={entry.completionRate} tone={entry.completionRate >= 70 ? 'green' : entry.completionRate >= 40 ? 'amber' : 'red'} className="flex-1" />
                          <span className="mono text-[10.5px] text-[var(--txt-3)] w-8 text-right">{entry.completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {loads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-[12px] text-[var(--txt-3)] py-6">
                        Sin datos de asignación en el período.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* IA */}
        <Card className="p-4">
          <SectionHeader
            eyebrow="Asistente"
            title="Diagnóstico con IA"
            subtitle="Analiza KPIs, riesgos y próximos pasos."
            action={<Sparkles size={16} className="text-[var(--violet)]" />}
          />

          <div className="mt-3 space-y-3">
            <Field label="Objetivos o contexto" hint={canUseAi ? 'Opcional: ej. reducir vencidas al 5% este mes.' : 'Requiere rol Administrador o Desarrollo.'}>
              <Textarea value={goals} onChange={(event) => setGoals(event.target.value)} rows={2} placeholder="Contale a la IA qué querés optimizar…" disabled={!canUseAi} />
            </Field>
            <Button variant="primary" icon={Wand2} onClick={runAnalysis} loading={analyzing} className="w-full" disabled={!canUseAi}>
              {analyzing ? 'Analizando…' : 'Generar diagnóstico'}
            </Button>
          </div>

          {analysis ? (
            <div className="mt-4 space-y-3">
              {typeof analysis.healthScore === 'number' ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Índice de salud operativa</span>
                    <span className="mono text-[16px] text-[var(--txt)]">{analysis.healthScore}/100</span>
                  </div>
                  <Progress value={analysis.healthScore} tone={analysis.healthScore >= 70 ? 'green' : analysis.healthScore >= 40 ? 'amber' : 'red'} className="mt-2" />
                  {analysis.riskLevel ? <div className="text-[11px] text-[var(--txt-3)] mt-1.5">Riesgo: {analysis.riskLevel}</div> : null}
                </div>
              ) : null}

              {analysis.executiveSummary ? (
                <div>
                  <div className="eyebrow mb-1">Resumen ejecutivo</div>
                  <p className="text-[12.5px] text-[var(--txt-2)] leading-relaxed">{analysis.executiveSummary}</p>
                </div>
              ) : null}

              {Array.isArray(analysis.strengths) && analysis.strengths.length > 0 ? (
                <div>
                  <div className="eyebrow mb-1">Fortalezas</div>
                  <ul className="space-y-1">
                    {analysis.strengths.map((item, index) => (
                      <li key={index} className="text-[12px] text-[var(--txt-2)] flex gap-1.5">
                        <span className="text-[#55e8b8]">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {Array.isArray(analysis.risks) && analysis.risks.length > 0 ? (
                <div>
                  <div className="eyebrow mb-1">Riesgos</div>
                  <ul className="space-y-1">
                    {analysis.risks.map((item, index) => (
                      <li key={index} className="text-[12px] text-[var(--txt-2)] flex gap-1.5">
                        <span className="text-[#ffc971]">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {Array.isArray(analysis.recommendations) && analysis.recommendations.length > 0 ? (
                <div>
                  <div className="eyebrow mb-1">Recomendaciones</div>
                  <ul className="space-y-1">
                    {analysis.recommendations.map((item, index) => (
                      <li key={index} className="text-[12px] text-[var(--txt-2)] flex gap-1.5">
                        <span className="text-[var(--accent-2)]">→</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {analysis.predictedTrend ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-3">
                  <div className="eyebrow mb-1">Tendencia proyectada</div>
                  <p className="text-[12px] text-[var(--txt-2)] leading-relaxed">{analysis.predictedTrend}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] px-3 py-6 text-center">
              <Download size={18} className="mx-auto text-[var(--txt-3)]" />
              <p className="text-[11.5px] text-[var(--txt-3)] mt-2 leading-relaxed">
                El diagnóstico aparecerá acá. Requiere `GEMINI_API_KEY` configurada en el servidor.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
