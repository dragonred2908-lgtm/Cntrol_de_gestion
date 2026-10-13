import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  RefreshCw,
  PlusCircle,
  Sliders,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
} from 'lucide-react';
import { Order, Member } from '../types';

export interface KpiIndicator {
  name: string;
  current: number;
  target: number;
  unit: string;
  status: 'optimo' | 'alerta' | 'critico';
  deviationPct: number;
  analysis: string;
}

export interface KpiDeviation {
  kpi: string;
  severity: 'baja' | 'media' | 'alta' | 'critica';
  rootCause: string;
  businessImpact: string;
}

export interface CorrectiveAction {
  id: number;
  title: string;
  actionStep: string;
  ownerRole: string;
  urgency: 'inmediata' | 'alta' | 'media';
  expectedImpact: string;
}

export interface KpiAnalysisResult {
  source: 'gemini-3.8-flash' | 'deterministic-fallback';
  overallHealth: 'optimo' | 'atencion' | 'critico';
  overallScore: number;
  summary: string;
  indicators: KpiIndicator[];
  detectedDeviations: KpiDeviation[];
  correctiveActions: [CorrectiveAction, CorrectiveAction, CorrectiveAction];
  generatedAt: string;
}

interface KpiAiAnalysisPanelProps {
  orders: Order[];
  members: Member[];
  onCreateOrderFromAction?: (action: CorrectiveAction) => void;
}

export function KpiAiAnalysisPanel({
  orders,
  members,
  onCreateOrderFromAction,
}: KpiAiAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<KpiAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Editable target goals
  const [targetCompletionRate, setTargetCompletionRate] = useState(85);
  const [maxOverdueRate, setMaxOverdueRate] = useState(5);
  const [targetSlaHours, setTargetSlaHours] = useState(24);

  const fetchAiAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze-kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customGoals: {
            targetCompletionRatePct: Number(targetCompletionRate),
            maxOverduePct: Number(maxOverdueRate),
            targetSlaHours: Number(targetSlaHours),
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Error en servidor: ${res.status}`);
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el motor de IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch if orders exist
    if (orders.length > 0 && !analysis) {
      fetchAiAnalysis();
    }
  }, [orders.length]);

  const getStatusColor = (status: 'optimo' | 'alerta' | 'critico') => {
    switch (status) {
      case 'optimo':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
      case 'alerta':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
      case 'critico':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/40';
      default:
        return 'text-slate-300 bg-slate-800/40 border-slate-700/40';
    }
  };

  const getUrgencyBadge = (urgency: 'inmediata' | 'alta' | 'media') => {
    switch (urgency) {
      case 'inmediata':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'alta':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'media':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Trigger */}
      <div className="rounded-2xl border border-blue-900/40 bg-gradient-to-r from-[#0d1527] via-[#11192e] to-[#0e1626] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Motor de IA: Análisis de KPIs y Desvíos
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  Gemini 3.8 Flash
                </span>
              </h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Audita métricas en tiempo real contra metas organizacionales, detecta cuellos de botella con desviación porcentual y prescribe 3 acciones correctivas operacionales.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                showConfig
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-[#182032] hover:bg-[#1f2a42] border-slate-700/60 text-slate-300'
              }`}
              type="button"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Metas ({targetCompletionRate}% / {targetSlaHours}h)</span>
            </button>

            <button
              onClick={fetchAiAnalysis}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 border border-blue-400/30 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              type="button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Analizando Métricas...' : 'Ejecutar Análisis IA'}</span>
            </button>
          </div>
        </div>

        {/* Target Goals Configuration Collapsible */}
        {showConfig && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="space-y-1 bg-[#101726]/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-400 block font-sans font-medium text-[11px]">
                Meta Finalización de Órdenes (%):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={targetCompletionRate}
                  onChange={(e) => setTargetCompletionRate(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <span className="font-bold text-white w-10 text-right">{targetCompletionRate}%</span>
              </div>
            </div>

            <div className="space-y-1 bg-[#101726]/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-400 block font-sans font-medium text-[11px]">
                Tolerancia Máx. Órdenes Vencidas (%):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={maxOverdueRate}
                  onChange={(e) => setMaxOverdueRate(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <span className="font-bold text-white w-10 text-right">{maxOverdueRate}%</span>
              </div>
            </div>

            <div className="space-y-1 bg-[#101726]/60 p-3 rounded-xl border border-slate-800">
              <label className="text-slate-400 block font-sans font-medium text-[11px]">
                SLA Promedio Meta (Horas):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="6"
                  max="72"
                  value={targetSlaHours}
                  onChange={(e) => setTargetSlaHours(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <span className="font-bold text-white w-10 text-right">{targetSlaHours}h</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAiAnalysis}
            className="underline hover:text-white cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main Analysis Display */}
      {analysis && (
        <div className="space-y-6">
          {/* Executive Summary & Score */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-[#121722] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Diagnóstico Ejecutivo
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(analysis.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans font-medium">
                {analysis.summary}
              </p>
              <div className="pt-2 flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>Fuente: <strong className="text-slate-200">{analysis.source}</strong></span>
                <span>•</span>
                <span>Órdenes Evaluadas: <strong className="text-slate-200">{orders.length}</strong></span>
                <span>•</span>
                <span>Miembros: <strong className="text-slate-200">{members.length}</strong></span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#121722] p-5 flex flex-col justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
                Índice de Salud Operativa
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white font-mono">
                  {analysis.overallScore}
                </span>
                <span className="text-sm font-mono text-slate-400">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    analysis.overallScore >= 80
                      ? 'bg-emerald-500'
                      : analysis.overallScore >= 55
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, analysis.overallScore)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Indicators Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Indicadores de Rendimiento (Métrica vs. Meta)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {analysis.indicators.map((ind, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800/80 bg-[#131824] p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 leading-tight">
                      {ind.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold border ${getStatusColor(
                        ind.status
                      )}`}
                    >
                      {ind.status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-extrabold font-mono text-white">
                        {ind.current}
                      </span>
                      <span className="text-xs font-mono text-slate-400 ml-1">{ind.unit}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-mono text-slate-400 block">
                        Meta: {ind.target} {ind.unit}
                      </span>
                      <div className="flex items-center gap-0.5 justify-end font-mono text-xs font-bold">
                        {ind.deviationPct >= 0 ? (
                          <span className="text-emerald-400 flex items-center">
                            <ArrowUpRight className="w-3 h-3" />
                            +{ind.deviationPct}%
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center">
                            <ArrowDownRight className="w-3 h-3" />
                            {ind.deviationPct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans border-t border-slate-800/60 pt-2 leading-snug">
                    {ind.analysis}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Detected Deviations */}
          {analysis.detectedDeviations.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-[#121620] p-5 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Desvíos Críticos Detectados en Procesos
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.detectedDeviations.map((dev, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-800/70 bg-[#0d111a] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200">{dev.kpi}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold ${
                          dev.severity === 'alta' || dev.severity === 'critica'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        Severidad {dev.severity}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">
                      <strong className="text-slate-400">Causa Raíz:</strong> {dev.rootCause}
                    </div>
                    <div className="text-xs text-slate-400">
                      <strong className="text-slate-500">Impacto Operacional:</strong> {dev.businessImpact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strictly 3 Corrective Actions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Plan de Remediación: 3 Acciones Correctivas Prescritas
              </h3>
              <span className="text-xs font-mono text-slate-400">
                3 Acciones Obligatorias
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysis.correctiveActions.map((action, idx) => (
                <div
                  key={action.id || idx}
                  className="rounded-xl border border-slate-800 bg-[#131926] p-5 flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition relative overflow-hidden group shadow-md"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 text-[11px]">
                          {idx + 1}
                        </span>
                        Acción Prioritaria
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border font-bold ${getUrgencyBadge(
                          action.urgency
                        )}`}
                      >
                        {action.urgency}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white group-hover:text-blue-300 transition">
                      {action.title}
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {action.actionStep}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                      <div className="text-slate-400 flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-500">Rol Responsable:</span>
                        <strong className="text-slate-200">{action.ownerRole}</strong>
                      </div>
                      <div className="text-slate-400">
                        <span className="font-mono text-[11px] text-slate-500">Impacto Estimado:</span>{' '}
                        <span className="text-emerald-400">{action.expectedImpact}</span>
                      </div>
                    </div>
                  </div>

                  {onCreateOrderFromAction && (
                    <button
                      onClick={() => onCreateOrderFromAction(action)}
                      className="w-full py-2 px-3 rounded-lg bg-[#1a2234] hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 font-mono text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                      type="button"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Convertir en Orden Operativa</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
