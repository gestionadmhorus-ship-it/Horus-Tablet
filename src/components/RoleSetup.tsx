import { useState, useEffect, useRef } from 'react';
import { Server, User } from 'lucide-react';
import type { AppRole } from '../types';
import { Html5Qrcode } from 'html5-qrcode';

interface RoleSetupProps {
  onComplete: (role: AppRole, deviceName: string, targetServerId?: string, myServerId?: string) => void;
}

export function RoleSetup({ onComplete }: RoleSetupProps) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');

  const [scanning, setScanning] = useState(false);

  const generateUUID = () => {
    return 'horus-server-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleStartClientSetup = () => {
    if (!deviceName.trim()) {
      setError('Debes ingresar un nombre para identificar esta tablet.');
      return;
    }
    setScanning(true);
  };

  // Stable ref for onComplete to avoid re-running the effect on every render
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!scanning) return;

    const qrScanner = new Html5Qrcode('reader');
    // Guard flag: ensures stop() is called exactly once
    let isStopping = false;

    const handleSuccess = (decodedText: string) => {
      if (isStopping) return;
      isStopping = true;
      qrScanner.stop()
        .catch(() => {})
        .finally(() => {
          setScanning(false);
          onCompleteRef.current('client', deviceName.trim(), decodedText, undefined);
        });
    };

    const startScanner = () => {
      qrScanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleSuccess,
          () => {} // per-frame error: ignore
        )
        .catch(() => {
          // Fallback: front camera if no back camera available
          qrScanner
            .start(
              { facingMode: 'user' },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              handleSuccess,
              () => {}
            )
            .catch(console.error);
        });
    };

    startScanner();

    return () => {
      // Cleanup: only stop if not already stopping from success callback
      if (!isStopping) {
        isStopping = true;
        qrScanner.stop().catch(() => {});
      }
    };
  }, [scanning, deviceName]); // onComplete excluded — using ref above

  const handleCompleteServer = () => {
    const myId = generateUUID();
    onComplete('server', 'Servidor-Alfa', undefined, myId);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-dark)',
      padding: '1rem',
      position: 'relative'
    }}>
      <div className="glass" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '2.5rem',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        {/* Logo + Branding */}
        <div style={{ marginBottom: '1.5rem' }}>
          <img src="/logo_horus_nuevo.png" alt="Horus Dron" style={{ height: '70px', marginBottom: '0.75rem' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '3px', color: 'var(--primary)', margin: 0, textTransform: 'uppercase' }}>
            Hermes <span style={{ fontStyle: 'italic' }}>II</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase', margin: '0.25rem 0 0 0' }}>
            Horus Dron — Imágenes Aéreas
          </p>
        </div>

        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'white' }}>Configuración Inicial</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Define el rol de este dispositivo en la red.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setRole('server')}
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: `2px solid ${role === 'server' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
              background: role === 'server' ? 'rgba(240,196,25,0.1)' : 'rgba(255,255,255,0.02)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Server size={32} color={role === 'server' ? 'var(--primary)' : '#888'} />
            <span style={{ fontWeight: 'bold' }}>Jefe (Servidor)</span>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Recibe y consolida datos</span>
          </button>

          <button
            onClick={() => setRole('client')}
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: `2px solid ${role === 'client' ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
              background: role === 'client' ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.02)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <User size={32} color={role === 'client' ? '#00ff88' : '#888'} />
            <span style={{ fontWeight: 'bold' }}>Explorador (Cliente)</span>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>Envía datos al Jefe</span>
          </button>
        </div>

        {role === 'client' && (
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Nombre de Identificación (Ej. Dron-Alfa)
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => {
                setDeviceName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Escribe el nombre de esta tablet"
              className="glass-input"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {role === 'server' && (
          <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(240,196,25,0.1)', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.9rem' }}>
            Esta tablet se convertirá en el concentrador de datos. Asegúrate de que sea la única configurada como Servidor.
          </div>
        )}

        {error && (
          <div style={{ color: '#ff4444', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {scanning && (
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <h3 style={{ color: 'white', marginBottom: '1rem' }}>Escanea el código del Jefe</h3>
            <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}></div>
            <button
              onClick={() => setScanning(false)}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        )}

        {!scanning && (
          <button
            onClick={role === 'server' ? handleCompleteServer : handleStartClientSetup}
            className="btn-3d"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: 'white', color: 'black' }}
          >
            {role === 'client' ? 'Siguiente (Escanear QR)' : 'Guardar Configuración'}
          </button>
        )}
      </div>
    </div>
  );
}
