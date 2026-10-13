import React, { useState } from 'react';
import { Shield, Lock, CheckCircle2, AlertCircle, X, KeyRound } from 'lucide-react';
import { UserRole, UserSession } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
  onLoginSuccess: (session: UserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  session,
  onLoginSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(session.role);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al autenticar');
      }

      onLoginSuccess({
        role: data.role,
        name: data.name,
        authenticated: data.authenticated,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'PIN incorrecto. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetViewer = () => {
    onLoginSuccess({
      role: 'viewer',
      name: 'Observador (Solo Lectura)',
      authenticated: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0e16]/80 backdrop-blur-sm p-4 font-sans">
      <div className="bg-[#181c24] border border-[#31353e] rounded-xl w-full max-w-md p-6 shadow-2xl relative text-[#dfe2ee]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8c909f] hover:text-[#dfe2ee] p-1 rounded-lg hover:bg-[#1c2028] transition cursor-pointer"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-[#4d8eff]/15 text-[#adc6ff] border border-[#4d8eff]/30 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#dfe2ee]">Control de Acceso Seguro</h2>
            <p className="text-xs text-[#8c909f]">
              Panel reservado para Administrador y Personal de Desarrollo
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-2 font-mono">
              SELECCIONAR ROL DE OPERACIÓN
            </label>
            <div className="grid grid-cols-2 gap-2 font-sans">
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                  selectedRole === 'admin'
                    ? 'bg-[#4d8eff]/15 border-[#4d8eff] text-[#dfe2ee]'
                    : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
                }`}
              >
                <div className="text-xs font-semibold flex items-center justify-between">
                  <span>Administrador</span>
                  {selectedRole === 'admin' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4d8eff]" />
                  )}
                </div>
                <p className="text-[10px] text-[#8c909f] mt-1">
                  Designa órdenes, asigna profesionales y emite recordatorios.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('developer')}
                className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                  selectedRole === 'developer'
                    ? 'bg-[#4d8eff]/15 border-[#4d8eff] text-[#dfe2ee]'
                    : 'bg-[#0a0e16] border-[#31353e]/50 text-[#8c909f] hover:bg-[#1c2028]'
                }`}
              >
                <div className="text-xs font-semibold flex items-center justify-between">
                  <span>Desarrollo</span>
                  {selectedRole === 'developer' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4d8eff]" />
                  )}
                </div>
                <p className="text-[10px] text-[#8c909f] mt-1">
                  Diagnóstico de Webhooks, simulación de bot y telemetría.
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#dfe2ee] mb-1 font-mono">
              PIN DE ACCESO
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#8c909f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ingrese PIN (Por defecto: 123456)"
                className="w-full pl-9 pr-4 py-2 bg-[#0a0e16] border border-[#31353e]/50 rounded-lg text-sm text-[#dfe2ee] placeholder-[#8c909f] focus:outline-none focus:border-[#4d8eff] font-mono tracking-widest"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-[#8c909f] mt-1 font-mono">
              * PIN predeterminado configurado: <code className="text-[#adc6ff]">123456</code> (o 1234).
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-[#181c24] border border-[#ef4444]/60 text-[#f87171] text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 font-mono text-[11px]">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:flex-1 py-2 px-4 rounded-lg bg-[#4d8eff] hover:bg-[#adc6ff] hover:text-[#002e6a] text-[#00285d] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Verificando...' : 'Desbloquear Acceso'}</span>
            </button>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  onLoginSuccess({
                    role: 'operator',
                    name: 'Operador de Campo',
                    authenticated: true,
                  });
                  onClose();
                }}
                className="flex-1 sm:flex-initial py-2 px-2.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#229ed9] hover:text-white font-medium border border-[#229ed9]/30 transition cursor-pointer"
                title="Probar vista restringida de operador (Exclusiva por Telegram)"
              >
                Rol Operador
              </button>
              <button
                type="button"
                onClick={handleSetViewer}
                className="flex-1 sm:flex-initial py-2 px-2.5 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#8c909f] hover:text-[#dfe2ee] font-medium border border-[#31353e]/50 transition cursor-pointer"
              >
                Observador
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
