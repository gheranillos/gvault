"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchRows = async () => {
    const res = await fetch("/api/admin/allowed-users", { cache: "no-store" });
    const json = await res.json();
    return { ok: res.ok, json };
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const result = await fetchRows();
      if (cancelled) return;
      if (!result.ok) {
        setMessage(result.json.error || "No se pudo cargar");
        setRows([]);
      } else {
        setRows(result.json.data || []);
        setMessage("");
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const addOrUpdate = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/allowed-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        subscription_active: active,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || "No se pudo guardar");
      return;
    }
    setEmail("");
    setActive(true);
    const result = await fetchRows();
    if (!result.ok) {
      setMessage(result.json.error || "No se pudo recargar");
      return;
    }
    setRows(result.json.data || []);
    setMessage("Guardado");
  };

  const toggleActive = async (id, nextValue) => {
    const res = await fetch("/api/admin/allowed-users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, subscription_active: nextValue }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "No se pudo actualizar");
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? json.data : r)));
  };

  const removeRow = async (id) => {
    const res = await fetch(`/api/admin/allowed-users?id=${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "No se pudo eliminar");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="screen active">
      <div className="historial-header">
        <h2>Admin</h2>
        <div className="auth-sub">Gestion de accesos y suscripcion activa</div>
      </div>

      <div className="form-body">
        <form onSubmit={addOrUpdate} className="preview-card">
          <div className="field-group">
            <div className="field-label">Email clienta</div>
            <input
              className="field-input"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <label className="preview-row" style={{ cursor: "pointer" }}>
            <span className="preview-key">Subscription activa</span>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
          </label>
          <button className="submit-btn" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Agregar / Actualizar"}
          </button>
        </form>

        {message ? <div className="auth-sub">{message}</div> : null}

        <div className="historial-list" style={{ padding: 0 }}>
          {loading ? (
            <div className="auth-sub">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">Sin clientas en whitelist</div>
              <div className="empty-sub">Agrega correos para habilitar acceso</div>
            </div>
          ) : (
            rows.map((row) => (
              <div className="tx-item" key={row.id}>
                <div className="tx-info">
                  <div className="tx-name">{row.email}</div>
                  <div className="tx-meta">
                    {row.subscription_active ? "Activa" : "Inactiva"}
                  </div>
                </div>
                <div className="tx-amounts" style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="month-arrow"
                    type="button"
                    onClick={() => toggleActive(row.id, !row.subscription_active)}
                    title="Toggle active"
                  >
                    {row.subscription_active ? "✓" : "✕"}
                  </button>
                  <button
                    className="month-arrow"
                    type="button"
                    onClick={() => removeRow(row.id)}
                    title="Eliminar"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
