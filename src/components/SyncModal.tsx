import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Monitor, Tablet } from 'lucide-react';
import { HorusSyncManager } from '../utils/syncUtils';
import type { AppData } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onSyncReceived?: (incomingData: AppData) => Promise<void>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  data,
  onSyncReceived
}) => {
  const [syncMode, setSyncMode] = useState<'select' | 'send' | 'receive'>('select');
  const [syncCode, setSyncCode] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [syncIsError, setSyncIsError] = useState(false);
  const [syncIsSuccess, setSyncIsSuccess] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize HorusSyncManager using useMemo
  const syncManager = useMemo(() => new HorusSyncManager(), []);

  // Cleanup connections on modal close or unmount
  useEffect(() => {
    return () => {
      syncManager.cleanup();
    };
  }, [syncManager]);

  // Handle modal close
  const handleClose = () => {
    syncManager.cleanup();
    setSyncMode('select');
    setSyncCode('');
    setSyncStatus('');
    setSyncIsError(false);
    setSyncIsSuccess(false);
    setIsConnecting(false);
    onClose();
  };

  const handleStartReceive = () => {
    setSyncMode('receive');
    setSyncIsError(false);
    setSyncIsSuccess(false);
    setIsConnecting(true);
    
    // Generate a random 4-digit code
    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    setSyncCode(generatedCode);

    const startWithCode = (codeToUse: string) => {
      setSyncCode(codeToUse);
      syncManager.startReceiver(
        codeToUse,
        (status, isErr) => {
          setSyncStatus(status);
          if (isErr !== undefined) setSyncIsError(isErr);
          // Connection open, finished, or errored out resets the button loading state
          if (isErr || status.includes('📡 Esperando') || status.includes('✅') || status.includes('❌')) {
            setIsConnecting(false);
          }
        },
        async (payload) => {
          if (onSyncReceived) {
            await onSyncReceived(payload);
            setSyncIsSuccess(true);
          } else {
            setSyncIsError(true);
            setSyncStatus('Sincronización no configurada.');
          }
        },
        () => {
          // Collision detected! Wait 800ms to clean up the socket, then generate a new code and try again!
          setTimeout(() => {
            const newCode = Math.floor(1000 + Math.random() * 9000).toString();
            startWithCode(newCode);
          }, 800);
        }
      );
    };

    startWithCode(generatedCode);
  };

  const handleStartSend = () => {
    if (syncCode.length !== 4) return;
    setSyncIsError(false);
    setSyncIsSuccess(false);
    setSyncStatus('Iniciando transferencia...');
    setIsConnecting(true);

    // Transmit full AppData
    syncManager.sendPayload(
      syncCode,
      data,
      (status, isErr, isSuccess) => {
        setSyncStatus(status);
        if (isErr !== undefined) setSyncIsError(isErr);
        if (isSuccess !== undefined) setSyncIsSuccess(isSuccess);
        // Completed connection resets connecting state
        if (isErr || isSuccess || status.includes('❌') || status.includes('✅')) {
          setIsConnecting(false);
        }
      }
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2500,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass"
            style={{
              padding: '2.5rem',
              width: '90%',
              maxWidth: '480px',
              border: '1px solid rgba(0,255,136,0.2)',
              boxShadow: '0 0 50px rgba(0,255,136,0.1)',
              borderRadius: '12px',
              background: 'rgba(5,10,18,0.98)',
              position: 'relative'
            }}
          >
            <button
              onClick={handleClose}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>

            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, textAlign: 'center', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'white' }}>
              <RefreshCw size={24} className="spinning" style={{ color: '#00ff88' }} /> Sincronización
            </h3>

            {syncMode === 'select' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '2rem 0' }}>
                <p style={{ textAlign: 'center', color: '#AAA', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Selecciona el rol de este dispositivo para iniciar la transferencia de datos.
                </p>

                <button
                  onClick={handleStartReceive}
                  disabled={isConnecting}
                  className="btn-3d"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(0,242,255,0.1) 0%, rgba(0,242,255,0.2) 100%)',
                    border: '1px solid #00f2d1', color: 'white', 
                    cursor: isConnecting ? 'not-allowed' : 'pointer', borderRadius: '8px',
                    boxShadow: '0 0 15px rgba(0,242,255,0.1)',
                    opacity: isConnecting ? 0.5 : 1
                  }}
                >
                  <Monitor size={36} style={{ color: '#00f2d1' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#00f2d1' }}>{isConnecting ? 'INICIANDO...' : 'RECIBIR EN OFICINA'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#AAA' }}>Muestra un código y recibe los datos de campo.</div>
                  </div>
                </button>

                <button
                  onClick={() => setSyncMode('send')}
                  disabled={isConnecting}
                  className="btn-3d"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(240,196,25,0.1) 0%, rgba(240,196,25,0.2) 100%)',
                    border: '1px solid var(--primary)', color: 'white', 
                    cursor: isConnecting ? 'not-allowed' : 'pointer', borderRadius: '8px',
                    boxShadow: '0 0 15px rgba(240,196,25,0.1)',
                    opacity: isConnecting ? 0.5 : 1
                  }}
                >
                  <Tablet size={36} style={{ color: 'var(--primary)' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>ENVIAR DESDE CAMPO</div>
                    <div style={{ fontSize: '0.8rem', color: '#AAA' }}>Escribe el código para mandar tus reportes.</div>
                  </div>
                </button>
              </div>
            )}

            {syncMode === 'receive' && (
              <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                <p style={{ color: '#AAA', fontSize: '0.85rem' }}>Escribe este código de 4 dígitos en la tablet de campo:</p>
                
                {/* Large Numbers */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', margin: '1.5rem 0' }}>
                  {syncCode.split('').map((char, idx) => (
                    <span key={idx} style={{
                      background: 'rgba(0,242,255,0.08)',
                      border: '2px solid #00f2d1',
                      borderRadius: '8px',
                      width: '60px',
                      height: '70px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem',
                      fontWeight: 900,
                      color: '#00f2d1',
                      textShadow: '0 0 15px rgba(0,242,255,0.5)'
                    }}>
                      {char}
                    </span>
                  ))}
                </div>

                {/* Pulsing Radar light */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '2rem 0' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: syncIsError ? '#ff1744' : (syncIsSuccess ? '#00ff88' : '#00f2d1'),
                    boxShadow: `0 0 15px ${syncIsError ? '#ff1744' : (syncIsSuccess ? '#00ff88' : '#00f2d1')}`,
                    animation: syncIsSuccess || syncIsError ? 'none' : 'pulse 1.5s infinite'
                  }} />
                  <span style={{ color: '#E0E0E0', fontSize: '0.95rem', fontWeight: 'bold' }}>{syncStatus}</span>
                </div>

                <button
                  onClick={() => { syncManager.cleanup(); setSyncMode('select'); setSyncCode(''); }}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#AAA', padding: '0.75rem 2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Atrás
                </button>
              </div>
            )}

            {syncMode === 'send' && (
              <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                <p style={{ color: '#AAA', fontSize: '0.85rem', marginBottom: '1rem' }}>Escribe el código mostrado en la computadora de la oficina:</p>

                {/* Code Input display */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {[0, 1, 2, 3].map(idx => (
                    <span key={idx} style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `2px solid ${syncCode[idx] ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: '8px',
                      width: '55px',
                      height: '65px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.2rem',
                      fontWeight: 900,
                      color: 'var(--primary)',
                      textShadow: syncCode[idx] ? '0 0 15px rgba(240,196,25,0.5)' : 'none'
                    }}>
                      {syncCode[idx] || ''}
                    </span>
                  ))}
                </div>

                {/* Tactical Keypad */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', maxWidth: '280px', margin: '1.5rem auto' }}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
                    <button key={n} disabled={isConnecting} onClick={() => { if (syncCode.length < 4) setSyncCode(prev => prev + n); }} style={{ padding: '0.8rem', fontSize: '1.4rem', fontWeight: 900, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'all 0.1s ease', opacity: isConnecting ? 0.4 : 1 }} onMouseDown={(e) => { if (!isConnecting) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }} onMouseUp={(e) => { if (!isConnecting) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>{n}</button>
                  ))}
                  <button disabled={isConnecting} onClick={() => setSyncCode('')} style={{ padding: '0.8rem', fontSize: '1rem', fontWeight: 900, background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.2)', color: '#ff1744', borderRadius: '8px', cursor: isConnecting ? 'not-allowed' : 'pointer', opacity: isConnecting ? 0.4 : 1 }}>BORRAR</button>
                  <button key="0" disabled={isConnecting} onClick={() => { if (syncCode.length < 4) setSyncCode(prev => prev + '0'); }} style={{ padding: '0.8rem', fontSize: '1.4rem', fontWeight: 900, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: isConnecting ? 'not-allowed' : 'pointer', opacity: isConnecting ? 0.4 : 1 }}>0</button>
                  <button onClick={handleStartSend} disabled={syncCode.length !== 4 || isConnecting} style={{ padding: '0.8rem', fontSize: '0.9rem', fontWeight: 900, background: (syncCode.length === 4 && !isConnecting) ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${(syncCode.length === 4 && !isConnecting) ? '#00ff88' : 'rgba(255,255,255,0.08)'}`, color: (syncCode.length === 4 && !isConnecting) ? '#00ff88' : '#666', borderRadius: '8px', cursor: (syncCode.length === 4 && !isConnecting) ? 'pointer' : 'not-allowed', opacity: isConnecting ? 0.5 : 1 }}>ENVIAR</button>
                </div>

                {/* Status Indicator */}
                {syncStatus && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', margin: '1.5rem 0' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: syncIsError ? '#ff1744' : (syncIsSuccess ? '#00ff88' : 'var(--primary)'),
                      boxShadow: `0 0 10px ${syncIsError ? '#ff1744' : (syncIsSuccess ? '#00ff88' : 'var(--primary)')}`
                    }} />
                    <span style={{ color: '#E0E0E0', fontSize: '0.85rem', fontWeight: 'bold' }}>{syncStatus}</span>
                  </div>
                )}

                <button
                  onClick={() => { syncManager.cleanup(); setSyncMode('select'); setSyncCode(''); setSyncStatus(''); }}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#AAA', padding: '0.6rem 2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '1rem' }}
                >
                  Atrás
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
