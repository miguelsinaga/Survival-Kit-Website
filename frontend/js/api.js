const API = {
  getSessionId() {
    return localStorage.getItem("sessionId");
  },
  
  setSessionId(sessionId) {
    if (sessionId) {
      localStorage.setItem("sessionId", sessionId);
    } else {
      localStorage.removeItem("sessionId");
    }
  },

  async get(path) {
    const headers = {};
    const sessionId = this.getSessionId();
    if (sessionId) headers["x-session-id"] = sessionId;
    
    const res = await fetch(path, { headers });
    return res.json();
  },

  async put(path, body) {
    const headers = { "Content-Type": "application/json" };
    const sessionId = this.getSessionId();
    if (sessionId) headers["x-session-id"] = sessionId;
    
    const res = await fetch(path, { method: "PUT", headers, body: JSON.stringify(body) });
    return res.json();
  },

  async post(path, body) {
    const headers = { "Content-Type": "application/json" };
    const sessionId = this.getSessionId();
    if (sessionId) headers["x-session-id"] = sessionId;
    
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    return res.json();
  },

  async del(path) {
    const headers = {};
    const sessionId = this.getSessionId();
    if (sessionId) headers["x-session-id"] = sessionId;
    
    const res = await fetch(path, { method: "DELETE", headers });
    return res.json();
  },

  async delete(path) {
    return this.del(path);
  },
};
