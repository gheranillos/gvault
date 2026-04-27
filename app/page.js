"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DEFAULT_EXTRA_OPTIONS = [
  { key: "dtf", label: "DTF" },
  { key: "bolsa", label: "Bolsa" },
  { key: "tarjeta", label: "Tarjeta" },
  { key: "stickers", label: "Stickers" },
  { key: "delivery", label: "Delivery" },
];

function normalizeExtraCategories(value) {
  if (!Array.isArray(value)) return DEFAULT_EXTRA_OPTIONS;
  const cleaned = value
    .map((item, index) => {
      const label = typeof item?.label === "string" ? item.label.trim() : "";
      if (!label) return null;
      const baseKey =
        typeof item?.key === "string" && item.key.trim()
          ? item.key.trim().toLowerCase()
          : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return { key: `${baseKey || "extra"}-${index + 1}`, label };
    })
    .filter(Boolean);
  return cleaned.length ? cleaned : DEFAULT_EXTRA_OPTIONS;
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export default function Home() {
  const now = new Date();
  const [activeScreen, setActiveScreen] = useState("screen-home");
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [ventas, setVentas] = useState([]);
  const [toast, setToast] = useState("");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({ email: "", password: "" });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    businessNiche: "",
    defaultInvestment: "",
    extraCategoriesRaw: "",
  });
  const [loading, setLoading] = useState(Boolean(supabase));
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [form, setForm] = useState({
    cliente: "",
    producto: "",
    cantidad: "",
    venta: "",
    costo: "",
  });
  const extraOptions = useMemo(
    () => normalizeExtraCategories(profile?.extra_categories),
    [profile],
  );

  const extrasTotal = useMemo(
    () =>
      Object.values(selectedExtras).reduce(
        (sum, value) => sum + (parseFloat(value) || 0),
        0,
      ),
    [selectedExtras],
  );

  const preview = useMemo(() => {
    const venta = parseFloat(form.venta) || 0;
    const costo = parseFloat(form.costo) || 0;
    const ganancia = venta - costo - extrasTotal;
    return { venta, costo, extras: extrasTotal, ganancia };
  }, [form.venta, form.costo, extrasTotal]);

  useEffect(() => {
    if (!supabase) return undefined;

    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    initAuth();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;

    const fetchUserData = async () => {
      setProfileLoading(true);
      const { data: ventasData, error: ventasError } = await supabase
        .from("ventas")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha", { ascending: false });

      if (!ventasError) {
        setVentas(ventasData ?? []);
      }

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("user_id,business_niche,default_investment,extra_categories")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile(profileData ?? null);
      setProfileLoading(false);
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!profile?.default_investment) return;
    setForm((prev) =>
      prev.costo
        ? prev
        : { ...prev, costo: String(profile.default_investment) },
    );
  }, [profile]);

  const monthVentas = useMemo(
    () =>
      ventas.filter((v) => {
        const d = new Date(v.fecha);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [ventas, currentMonth, currentYear],
  );

  const totalVendido = monthVentas.reduce((s, v) => s + v.venta, 0);
  const totalCosto = monthVentas.reduce((s, v) => s + v.costo, 0);
  const totalExtras = monthVentas.reduce((s, v) => s + v.extras, 0);
  const gananciaMes = totalVendido - totalCosto - totalExtras;
  const margen = totalVendido > 0 ? (gananciaMes / totalVendido) * 100 : 0;

  const recent = [...monthVentas]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5);

  const historial = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const goTo = (screen) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeMonth = (dir) => {
    let month = currentMonth + dir;
    let year = currentYear;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    setCurrentMonth(month);
    setCurrentYear(year);
  };

  const toggleChip = (key) => {
    setSelectedExtras((prev) => {
      const copy = { ...prev };
      if (copy[key] !== undefined) {
        delete copy[key];
      } else {
        copy[key] = "";
      }
      return copy;
    });
  };

  const resetForm = () => {
    setForm({
      cliente: "",
      producto: "",
      cantidad: "",
      venta: "",
      costo: profile?.default_investment ? String(profile.default_investment) : "",
    });
    setSelectedExtras({});
    setExtrasOpen(false);
  };

  const guardarVenta = async () => {
    if (!supabase || !user) return;

    const producto = form.producto.trim();
    const cliente = form.cliente.trim();
    const cantidad = parseInt(form.cantidad || "1", 10) || 1;
    const venta = parseFloat(form.venta) || 0;
    const costo = parseFloat(form.costo) || 0;
    if (!producto || venta === 0) return;

    let extras = 0;
    const extrasDetalle = {};
    Object.entries(selectedExtras).forEach(([k, val]) => {
      const v = parseFloat(val) || 0;
      extras += v;
      if (v > 0) extrasDetalle[k] = v;
    });

    const payload = {
      cliente,
      producto,
      cantidad,
      venta,
      costo,
      extras,
      extras_detalle: extrasDetalle,
      fecha: new Date().toISOString(),
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from("ventas")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      setToast("Error guardando venta");
      return;
    }

    setVentas((prev) => [data, ...prev]);
    resetForm();
    setToast("✓ Venta registrada");

    const current = new Date();
    setCurrentMonth(current.getMonth());
    setCurrentYear(current.getFullYear());
    goTo("screen-home");
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    if (!supabase || !user) return;

    const businessNiche = profileForm.businessNiche.trim();
    if (!businessNiche) {
      setToast("Completa el nicho de tu negocio");
      return;
    }

    const defaultInvestment = parseFloat(profileForm.defaultInvestment) || 0;
    const labels = profileForm.extraCategoriesRaw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const rawCategories = (labels.length ? labels : DEFAULT_EXTRA_OPTIONS.map((v) => v.label)).map(
      (label, index) => ({
        key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `extra-${index + 1}`,
        label,
      }),
    );
    const extraCategories = normalizeExtraCategories(rawCategories);

    setSavingProfile(true);
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: user.id,
          business_niche: businessNiche,
          default_investment: defaultInvestment,
          extra_categories: extraCategories,
        },
        { onConflict: "user_id" },
      )
      .select("user_id,business_niche,default_investment,extra_categories")
      .single();
    setSavingProfile(false);

    if (error) {
      setToast("Error guardando perfil");
      return;
    }

    setProfile(data);
    setForm((prev) => ({ ...prev, costo: String(defaultInvestment || "") }));
    setToast("Perfil guardado");
  };

  const cerrarSesion = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setVentas([]);
    resetForm();
  };

  const onAuthSubmit = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setSubmittingAuth(true);

    const email = authData.email.trim();
    const password = authData.password;

    const action =
      authMode === "register"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });

    const { error } = await action;
    setSubmittingAuth(false);

    if (error) {
      setToast(error.message);
      return;
    }

    setToast(authMode === "register" ? "Cuenta creada" : "Sesion iniciada");
  };

  if (loading) return <div className="auth-wrap">Cargando...</div>;

  if (!supabase) {
    return (
      <div className="auth-wrap">
        <div className="auth-title">Configura Supabase</div>
        <div className="auth-sub">
          Faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="auth-wrap">
          <div className="header-greeting">Mi tienda</div>
          <div className="auth-title">
            {authMode === "login" ? "Iniciar sesion" : "Crear cuenta"}
          </div>
          <div className="auth-sub">
            Accede para ver y registrar tus ventas en la nube.
          </div>

          <form className="form-body !px-0" onSubmit={onAuthSubmit}>
            <div className="field-group">
              <div className="field-label">Email</div>
              <input
                className="field-input"
                type="email"
                value={authData.email}
                onChange={(e) =>
                  setAuthData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>
            <div className="field-group">
              <div className="field-label">Contrasena</div>
              <input
                className="field-input"
                type="password"
                value={authData.password}
                onChange={(e) =>
                  setAuthData((prev) => ({ ...prev, password: e.target.value }))
                }
                minLength={6}
                required
              />
            </div>
            <button className="submit-btn" type="submit" disabled={submittingAuth}>
              {submittingAuth
                ? "Procesando..."
                : authMode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>
          </form>

          <div className="auth-sub">
            {authMode === "login" ? "No tienes cuenta?" : "Ya tienes cuenta?"}{" "}
            <span
              className="auth-switch"
              onClick={() =>
                setAuthMode((prev) => (prev === "login" ? "register" : "login"))
              }
            >
              {authMode === "login" ? "Registrate" : "Inicia sesion"}
            </span>
          </div>
        </div>
        <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      </>
    );
  }

  if (profileLoading) {
    return <div className="auth-wrap">Cargando perfil...</div>;
  }

  if (!profile) {
    return (
      <>
        <div className="auth-wrap">
          <div className="header-greeting">Personaliza tu panel</div>
          <div className="auth-title">Configura tu negocio</div>
          <div className="auth-sub">
            Esto solo lo completas una vez y queda guardado para tu cuenta.
          </div>
          <form className="form-body !px-0" onSubmit={guardarPerfil}>
            <div className="field-group">
              <div className="field-label">Nicho de negocio</div>
              <input
                className="field-input"
                type="text"
                placeholder="Ej: Ropa femenina, barberia..."
                value={profileForm.businessNiche}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, businessNiche: e.target.value }))
                }
                required
              />
            </div>
            <div className="field-group">
              <div className="field-label">Inversion base por venta $</div>
              <input
                className="field-input"
                type="number"
                min="0"
                placeholder="0.00"
                value={profileForm.defaultInvestment}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    defaultInvestment: e.target.value,
                  }))
                }
              />
            </div>
            <div className="field-group">
              <div className="field-label">Gastos extra (separados por coma)</div>
              <input
                className="field-input"
                type="text"
                placeholder="DTF, bolsa, delivery, publicidad"
                value={profileForm.extraCategoriesRaw}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    extraCategoriesRaw: e.target.value,
                  }))
                }
              />
            </div>
            <button className="submit-btn" type="submit" disabled={savingProfile}>
              {savingProfile ? "Guardando..." : "Guardar configuracion"}
            </button>
            <button
              className="submit-btn"
              type="button"
              style={{ background: "var(--surface2)", color: "var(--text)" }}
              onClick={cerrarSesion}
            >
              Cambiar de cuenta
            </button>
          </form>
        </div>
        <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      </>
    );
  }

  return (
    <>
      <div className={`screen ${activeScreen === "screen-home" ? "active" : ""}`}>
        <div className="header">
          <div>
            <div className="header-greeting">Mi tienda</div>
            <div className="header-name">Hola, {user.email?.split("@")[0]} 👋</div>
            <div className="auth-sub">
              Nicho: {profile.business_niche} · inversion base: $
              {Number(profile.default_investment || 0).toFixed(2)}
            </div>
          </div>
          <div
            className="avatar"
            onClick={cerrarSesion}
            title="Cerrar sesion"
            style={{ cursor: "pointer" }}
          >
            {(user.email?.[0] || "U").toUpperCase()}
          </div>
        </div>

        <div className="month-bar">
          <div className="month-arrow" onClick={() => changeMonth(-1)}>
            ‹
          </div>
          <div className="month-label">
            {MONTHS[currentMonth]} {currentYear}
          </div>
          <div className="month-arrow" onClick={() => changeMonth(1)}>
            ›
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-label">Ganancia del mes</div>
          <div className="hero-amount">
            <span>{gananciaMes < 0 ? "-$" : "$"}</span>
            <span>{Math.abs(gananciaMes).toFixed(2)}</span>
          </div>
          <div className="hero-status">
            <div className="dot"></div>
            <span>
              {monthVentas.length === 0
                ? "Sin ventas este mes"
                : gananciaMes > 0
                  ? `+${margen.toFixed(1)}% margen · vas bien 🔥`
                  : gananciaMes === 0
                    ? "Punto de equilibrio"
                    : "Cuidado, estas en perdida"}
            </span>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon green">💰</div>
            <div className="stat-label">Vendido</div>
            <div className="stat-value green">${totalVendido.toFixed(2)}</div>
            <div className="stat-sub">
              {monthVentas.length} venta{monthVentas.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">📦</div>
            <div className="stat-label">Invertido</div>
            <div className="stat-value red">${totalCosto.toFixed(2)}</div>
            <div className="stat-sub">costo total</div>
          </div>
          <div className="stat-card full">
            <div className="stat-icon yellow">📊</div>
            <div className="stat-label">Gastos adicionales</div>
            <div className="stat-value yellow">${totalExtras.toFixed(2)}</div>
            <div className="stat-sub">DTF · bolsa · delivery · otros</div>
          </div>
        </div>

        <div className="margin-bar-wrap">
          <div className="margin-bar-header">
            <span className="margin-bar-label">Margen de ganancia</span>
            <span className="margin-bar-pct">
              {totalVendido > 0 ? `${margen.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.min(Math.max(margen, 0), 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="section-title">
          <h3>Ultimas ventas</h3>
          <span className="see-all" onClick={() => goTo("screen-historial")}>
            Ver todo
          </span>
        </div>

        <div className="tx-list">
          {recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛍️</div>
              <div className="empty-title">Nada aun</div>
              <div className="empty-sub">
                Registra tu primera venta
                <br />
                tocando el boton +
              </div>
            </div>
          ) : (
            recent.map((v, i) => {
              const g = v.venta - v.costo - v.extras;
              return (
                <div
                  className="tx-item"
                  key={v.id}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="tx-dot">👗</div>
                  <div className="tx-info">
                    <div className="tx-name">{v.cliente || "Cliente"}</div>
                    <div className="tx-meta">
                      {v.producto} · {formatDate(v.fecha)}
                    </div>
                  </div>
                  <div className="tx-amounts">
                    <div className="tx-venta">${v.venta.toFixed(2)}</div>
                    <div
                      className="tx-ganancia"
                      style={{ color: g >= 0 ? "var(--accent)" : "var(--red)" }}
                    >
                      gan. ${g.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`screen ${activeScreen === "screen-form" ? "active" : ""}`}>
        <div className="form-header">
          <div className="back-btn" onClick={() => goTo("screen-home")}>
            ←
          </div>
          <div className="form-title">Nueva venta</div>
        </div>

        <div className="form-body">
          <div className="field-group">
            <div className="field-label">Cliente</div>
            <input
              className="field-input"
              type="text"
              placeholder="Nombre del cliente"
              value={form.cliente}
              onChange={(e) => setForm((p) => ({ ...p, cliente: e.target.value }))}
            />
          </div>

          <div className="field-group">
            <div className="field-label">Producto</div>
            <input
              className="field-input"
              type="text"
              placeholder="Ej: Royal Text, Castillo..."
              value={form.producto}
              onChange={(e) => setForm((p) => ({ ...p, producto: e.target.value }))}
            />
          </div>

          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Cantidad</div>
              <input
                className="field-input"
                type="number"
                placeholder="1"
                min="1"
                value={form.cantidad}
                onChange={(e) => setForm((p) => ({ ...p, cantidad: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <div className="field-label">Precio de venta $</div>
              <input
                className="field-input"
                type="number"
                placeholder="0.00"
                value={form.venta}
                onChange={(e) => setForm((p) => ({ ...p, venta: e.target.value }))}
              />
            </div>
          </div>

          <div className="field-group">
            <div className="field-label">Inversion / Costo $</div>
            <input
              className="field-input"
              type="number"
              placeholder={String(profile.default_investment || "0.00")}
              value={form.costo}
              onChange={(e) => setForm((p) => ({ ...p, costo: e.target.value }))}
            />
          </div>

          <div className="field-group">
            <div className="field-label">Costos adicionales</div>
            <div
              className={`extras-toggle ${extrasOpen ? "open" : ""}`}
              onClick={() => setExtrasOpen((v) => !v)}
            >
              <span className="extras-label">DTF, bolsa, delivery, stickers...</span>
              <span className="extras-arrow">⌄</span>
            </div>
            <div className={`extras-panel ${extrasOpen ? "open" : ""}`}>
              <div className="chip-row">
                {extraOptions.map((opt) => (
                  <div
                    className={`chip ${selectedExtras[opt.key] !== undefined ? "active" : ""}`}
                    key={opt.key}
                    onClick={() => toggleChip(opt.key)}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
              <div className="extra-input-row">
                {Object.keys(selectedExtras).map((key) => (
                  <div className="field-group" key={key}>
                    <div className="field-label">
                      {extraOptions.find((o) => o.key === key)?.label || key} $
                    </div>
                    <input
                      className="field-input"
                      type="number"
                      placeholder="0.00"
                      value={selectedExtras[key]}
                      onChange={(e) =>
                        setSelectedExtras((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-key">Venta</span>
              <span className="preview-val">${preview.venta.toFixed(2)}</span>
            </div>
            <div className="preview-row">
              <span className="preview-key">Costo producto</span>
              <span className="preview-val">-${preview.costo.toFixed(2)}</span>
            </div>
            <div className="preview-row">
              <span className="preview-key">Extras</span>
              <span className="preview-val">-${preview.extras.toFixed(2)}</span>
            </div>
            <div className="preview-divider"></div>
            <div className="preview-row">
              <span className="preview-total-key">Ganancia</span>
              <span
                className={`preview-total-val ${preview.ganancia < 0 ? "loss" : ""}`}
              >
                {preview.ganancia < 0 ? "-" : ""}${Math.abs(preview.ganancia).toFixed(2)}
              </span>
            </div>
          </div>

          <button className="submit-btn" onClick={guardarVenta}>
            Registrar venta
          </button>
        </div>
      </div>

      <div
        className={`screen ${activeScreen === "screen-historial" ? "active" : ""}`}
      >
        <div className="historial-header">
          <div
            className="back-btn"
            style={{ marginBottom: "16px" }}
            onClick={() => goTo("screen-home")}
          >
            ←
          </div>
          <h2>Historial</h2>
        </div>
        <div className="historial-list">
          {historial.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">Sin registros</div>
              <div className="empty-sub">Aqui apareceran todas tus ventas</div>
            </div>
          ) : (
            historial.map((v) => {
              const g = v.venta - v.costo - v.extras;
              return (
                <div className="tx-item" key={v.id}>
                  <div className="tx-dot">👗</div>
                  <div className="tx-info">
                    <div className="tx-name">
                      {v.cliente || "Cliente"} · {v.producto}
                    </div>
                    <div className="tx-meta">
                      {formatDate(v.fecha)} · cant: {v.cantidad}
                    </div>
                  </div>
                  <div className="tx-amounts">
                    <div className="tx-venta">${v.venta.toFixed(2)}</div>
                    <div
                      className="tx-ganancia"
                      style={{ color: g >= 0 ? "var(--accent)" : "var(--red)" }}
                    >
                      ${g.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bottom-nav">
        <div
          className={`nav-item ${activeScreen === "screen-home" ? "active" : ""}`}
          onClick={() => goTo("screen-home")}
        >
          <div className="nav-icon">⊞</div>
          <span>Inicio</span>
        </div>
        <div className="nav-add" onClick={() => goTo("screen-form")}>
          +
        </div>
        <div
          className={`nav-item ${activeScreen === "screen-historial" ? "active" : ""}`}
          onClick={() => goTo("screen-historial")}
        >
          <div className="nav-icon">☰</div>
          <span>Historial</span>
        </div>
      </div>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>

    </>
  );
}
