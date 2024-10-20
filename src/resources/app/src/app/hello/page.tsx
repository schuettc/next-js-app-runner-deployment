"use client";

import React, { useState, useEffect } from "react";

export default function HelloPage() {
  const [message, setMessage] = useState("");
  const [postMessage, setPostMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/hello");
        const data = await res.json();
        setMessage(data.message);
      } catch (error) {
        console.error("Error fetching data:", error);
        setMessage("Error fetching data");
      }
    };

    // Use void operator to explicitly ignore the promise
    void fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello from the client!" }),
      });
      const data = await res.json();
      setPostMessage(data.message);
    } catch (error) {
      console.error("Error sending POST request:", error);
      setPostMessage("Error sending POST request");
    }
  };

  return (
    <div>
      <h1>Hello Page</h1>
      <p>Message from API: {message}</p>
      <form onSubmit={handleSubmit}>
        <button type="submit">Send POST request</button>
      </form>
      {postMessage && <p>Response from POST: {postMessage}</p>}
    </div>
  );
}
