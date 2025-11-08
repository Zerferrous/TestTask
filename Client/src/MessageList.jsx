import React from 'react';

export function MessageList({ messages }) {
  return (
      <div className='messagesDiv'>
        {messages.map((msg, i) => (
          <div className='msgDiv' key={i} >
            Текст сообщения:
            <div>{msg.text}</div>
          </div>
        ))}
      </div>
  );
}
