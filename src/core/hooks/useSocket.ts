import { useEffect } from 'react';
import { socketClient } from '@/api/socket';

const useSocket = () => {
  useEffect(() => {
    // Ensure socket is connected
    const socket = socketClient.getSocket();
    if (socket && !socket.connected) {
      socket.connect();
    }

    return () => {
      // Optionally disconnect on unmount if needed
    };
  }, []);

  const on = (event: string, callback: (...args: any[]) => void) => {
    const socket = socketClient.getSocket();
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string, callback: (...args: any[]) => void) => {
    const socket = socketClient.getSocket();
    if (socket) {
      socket.off(event, callback);
    }
  };

  const emit = (event: string, data?: any) => {
    const socket = socketClient.getSocket();
    if (socket) {
      socket.emit(event, data);
    }
  };

  return { on, off, emit };
};

export default useSocket;
