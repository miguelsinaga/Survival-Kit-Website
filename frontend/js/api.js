const API = {
  async get(path) {
    const res = await fetch(path);
    return res.json();
  },
  async put(path, body) {
    const res = await fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  },
  async del(path) {
    const res = await fetch(path, { method: "DELETE" });
    return res.json();
  },
};
