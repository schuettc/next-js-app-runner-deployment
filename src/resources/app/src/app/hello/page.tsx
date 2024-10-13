'use client';

import { useState, useEffect } from 'react';

export default function HelloPage() {
  const [message, setMessage] = useState('');
  const [postMessage, setPostMessage] = useState('');

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => setMessage(data.message));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello from the client!' }),
    });
    const data = await res.json();
    setPostMessage(data.message);
  };

  return (
    <div>
      <h1>Hello Page</h1>
      <p>Message from API: {message}</p>
      <form onSubmit={handleSubmit}>
        <button type='submit'>Send POST request</button>
      </form>
      {postMessage && <p>Response from POST: {postMessage}</p>}
    </div>
  );
}
