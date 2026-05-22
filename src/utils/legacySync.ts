import { Peer, type DataConnection } from 'peerjs';
import type { AppData } from '../types';

const PEER_PREFIX = 'horus-tablet-pairing-';

export interface SyncMessage {
  type: 'SYNC_PAYLOAD' | 'SYNC_ACK' | 'SYNC_ERROR';
  payload?: AppData;
  message?: string;
}

export class HorusSyncManager {
  private peer: Peer | null = null;
  private activeConnection: DataConnection | null = null;

  /**
   * Generates a 4-digit code and starts listening for incoming connections
   */
  startReceiver(
    code: string,
    onStatusChange: (status: string, isError?: boolean) => void,
    onDataReceived: (data: AppData) => Promise<void>,
    onCollision?: () => void
  ) {
    this.cleanup();

    const peerId = `${PEER_PREFIX}${code}`;
    onStatusChange('🔌 Iniciando conexión en oficina...');

    // Connect to the free public PeerJS server
    this.peer = new Peer(peerId, {
      debug: 1,
    });

    this.peer.on('open', () => {
      onStatusChange(`📡 Esperando conexión en código: ${code}`);
    });

    this.peer.on('connection', (conn) => {
      this.activeConnection = conn;
      onStatusChange('🤝 Dispositivo conectado. Recibiendo datos...');

      conn.on('data', (data: any) => {
        const msg = data as SyncMessage;
        if (msg.type === 'SYNC_PAYLOAD' && msg.payload) {
          onDataReceived(msg.payload)
            .then(() => {
              conn.send({ type: 'SYNC_ACK', message: '¡Datos sincronizados con éxito en la oficina!' });
              onStatusChange('✅ ¡Sincronización completada con éxito!', false);
            })
            .catch((err) => {
              conn.send({ type: 'SYNC_ERROR', message: `Fallo al guardar: ${err.message}` });
              onStatusChange(`❌ Error al fusionar datos: ${err.message}`, true);
            });
        }
      });

      conn.on('close', () => {
        onStatusChange('🔌 Conexión cerrada.');
      });

      conn.on('error', (err) => {
        onStatusChange(`❌ Error de transferencia: ${err.message}`, true);
      });
    });

    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        if (onCollision) {
          onStatusChange('⚠️ Código en uso. Regenerando...', false);
          onCollision();
        } else {
          onStatusChange('⚠️ Este código ya está en uso. Vuelve a intentarlo.', true);
          this.cleanup();
        }
      } else {
        onStatusChange(`❌ Error de red: ${err.message}`, true);
        this.cleanup();
      }
    });
  }

  /**
   * Disconnects and cleans up all active network sockets
   */
  cleanup() {
    if (this.activeConnection) {
      this.activeConnection.close();
      this.activeConnection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
