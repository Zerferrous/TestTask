import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { MessageList } from './MessageList';

export default function App() {
  const [messages, setMessages] = useState([]);

  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('newMessage', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className='rootDiv'>
      <header>
        Мониторинг сообщений
      </header>
      {connected ? <MessageList messages={messages} /> : <div className='notConnectedDiv'> Не подключено</div>}
    </div>
  );
}
