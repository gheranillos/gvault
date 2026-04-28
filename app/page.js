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

function currency(value) {
  return Number(value || 0).toFixed(2);
}

function getDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function Home() {
  const now = new Date();
  const [activeScreen, setActiveScreen] = useState("screen-home");
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [ventas, setVentas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [toast, setToast] = useState("");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState({});
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({ email: "", password: "" });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [form, setForm] = useState({
    cliente: "",
    producto: "",
    cantidad: "",
    venta: "",
    costo: "",
    crearPendiente: false,
    montoPendiente: "",
  });
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    businessNiche: "",
    defaultInvestment: "",
    extraCategoriesRaw: "",
  });
  const [abonoInputs, setAbonoInputs] = useState({});

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

  const salesById = useMemo(
    () => Object.fromEntries(ventas.map((venta) => [venta.id, venta])),
    [ventas],
  );

  const abonosByCuenta = useMemo(() => {
    const map = {};
    abonos.forEach((abono) => {
      map[abono.cuenta_id] = (map[abono.cuenta_id] || 0) + Number(abono.monto || 0);
    });
    return map;
  }, [abonos]);

  const cuentasConSaldo = useMemo(
    () =>
      cuentas.map((cuenta) => {
        const abonado = abonosByCuenta[cuenta.id] || 0;
        const saldo = Math.max(Number(cuenta.monto_total || 0) - abonado, 0);
        return {
          ...cuenta,
          abonado,
          saldo,
          venta: salesById[cuenta.venta_id] || null,
          estadoReal: saldo <= 0 ? "pagado" : "pendiente",
        };
      }),
    [cuentas, abonosByCuenta, salesById],
  );

  const pendientesActivos = useMemo(
    () => cuentasConSaldo.filter((cuenta) => cuenta.saldo > 0),
    [cuentasConSaldo],
  );

  const monthVentas = useMemo(
    () =>
      ventas.filter((v) => {
        const d = new Date(v.fecha);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [ventas, currentMonth, currentYear],
  );

  const totalVendido = monthVentas.reduce((s, v) => s + Number(v.venta || 0), 0);
  const totalCosto = monthVentas.reduce((s, v) => s + Number(v.costo || 0), 0);
  const totalExtras = monthVentas.reduce((s, v) => s + Number(v.extras || 0), 0);
  const gananciaMes = totalVendido - totalCosto - totalExtras;
  const margen = totalVendido > 0 ? (gananciaMes / totalVendido) * 100 : 0;
  const totalPendiente = pendientesActivos.reduce((sum, c) => sum + c.saldo, 0);

  const recent = [...monthVentas]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5);
  const historial = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const ventasDelDia = useMemo(
    () => historial.filter((venta) => getDateKey(venta.fecha) === selectedDate),
    [historial, selectedDate],
  );

  const yearlyVentas = useMemo(
    () => ventas.filter((venta) => new Date(venta.fecha).getFullYear() === Number(selectedYear)),
    [ventas, selectedYear],
  );

  const yearlyByMonth = useMemo(() => {
    const init = Array.from({ length: 12 }, (_, month) => ({
      month,
      sold: 0,
      cost: 0,
      extras: 0,
      profit: 0,
      count: 0,
    }));
    yearlyVentas.forEach((venta) => {
      const month = new Date(venta.fecha).getMonth();
      const sold = Number(venta.venta || 0);
      const cost = Number(venta.costo || 0);
      const extras = Number(venta.extras || 0);
      init[month].sold += sold;
      init[month].cost += cost;
      init[month].extras += extras;
      init[month].profit += sold - cost - extras;
      init[month].count += 1;
    });
    return init;
  }, [yearlyVentas]);

  const yearlyTotals = useMemo(
    () =>
      yearlyByMonth.reduce(
        (acc, row) => ({
          sold: acc.sold + row.sold,
          cost: acc.cost + row.cost,
          extras: acc.extras + row.extras,
          profit: acc.profit + row.profit,
          count: acc.count + row.count,
        }),
        { sold: 0, cost: 0, extras: 0, profit: 0, count: 0 },
      ),
    [yearlyByMonth],
  );

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

      const ventasReq = supabase
        .from("ventas")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha", { ascending: false });

      const profileReq = supabase
        .from("user_profiles")
        .select("user_id,display_name,business_niche,default_investment,extra_categories")
        .eq("user_id", user.id)
        .maybeSingle();

      const cuentasReq = supabase
        .from("cuentas_por_cobrar")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha", { ascending: false });

      const abonosReq = supabase
        .from("abonos_cobro")
        .select("*")
        .eq("user_id", user.id)
        .order("fecha", { ascending: false });

      const [{ data: ventasData }, { data: profileData }, { data: cuentasData }, { data: abonosData }] =
        await Promise.all([ventasReq, profileReq, cuentasReq, abonosReq]);

      setVentas(ventasData || []);
      setProfile(profileData || null);
      setCuentas(cuentasData || []);
      setAbonos(abonosData || []);
      if (profileData) {
        setProfileForm({
          displayName: profileData.display_name || "",
          businessNiche: profileData.business_niche || "",
          defaultInvestment: String(profileData.default_investment || ""),
          extraCategoriesRaw: normalizeExtraCategories(profileData.extra_categories)
            .map((item) => item.label)
            .join(", "),
        });
      }
      if (profileData?.default_investment) {
        setForm((prev) =>
          prev.costo ? prev : { ...prev, costo: String(profileData.default_investment) },
        );
      }
      setProfileLoading(false);
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const goTo = (screen) => {
    setActiveScreen(screen);
    setAvatarMenuOpen(false);
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
      crearPendiente: false,
      montoPendiente: "",
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
    const montoPendiente = parseFloat(form.montoPendiente) || 0;

    if (!producto) {
      setToast("Completa el producto");
      return;
    }
    if (montoPendiente < 0 || montoPendiente > venta) {
      setToast("Pendiente invalido");
      return;
    }

    let extras = 0;
    const extrasDetalle = {};
    Object.entries(selectedExtras).forEach(([key, value]) => {
      const parsed = parseFloat(value) || 0;
      extras += parsed;
      if (parsed > 0) extrasDetalle[key] = parsed;
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

    const { data: ventaData, error: ventaError } = await supabase
      .from("ventas")
      .insert(payload)
      .select("*")
      .single();

    if (ventaError) {
      setToast("Error guardando venta");
      return;
    }

    setVentas((prev) => [ventaData, ...prev]);

    if (form.crearPendiente && montoPendiente > 0) {
      const { data: cuentaData, error: cuentaError } = await supabase
        .from("cuentas_por_cobrar")
        .insert({
          venta_id: ventaData.id,
          user_id: user.id,
          monto_total: montoPendiente,
          estado: "pendiente",
        })
        .select("*")
        .single();

      if (cuentaError) {
        setToast("Venta guardada, pero fallo el pendiente");
      } else {
        setCuentas((prev) => [cuentaData, ...prev]);
      }
    }

    resetForm();
    setToast("Venta registrada");
    const current = new Date();
    setCurrentMonth(current.getMonth());
    setCurrentYear(current.getFullYear());
    goTo("screen-home");
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    if (!supabase || !user) return;

    const displayName = profileForm.displayName.trim();
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
          display_name: displayName,
          business_niche: businessNiche,
          default_investment: defaultInvestment,
          extra_categories: extraCategories,
        },
        { onConflict: "user_id" },
      )
      .select("user_id,display_name,business_niche,default_investment,extra_categories")
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

  const registrarAbono = async (cuenta) => {
    if (!supabase || !user) return;
    const inputValue = abonoInputs[cuenta.id];
    const monto = parseFloat(inputValue) || 0;
    if (monto <= 0 || monto > cuenta.saldo) {
      setToast("Monto de abono invalido");
      return;
    }

    const { data: abonoData, error: abonoError } = await supabase
      .from("abonos_cobro")
      .insert({
        cuenta_id: cuenta.id,
        venta_id: cuenta.venta_id,
        user_id: user.id,
        monto,
      })
      .select("*")
      .single();

    if (abonoError) {
      setToast("Error guardando abono");
      return;
    }

    const nuevoSaldo = Math.max(cuenta.saldo - monto, 0);
    const nuevoEstado = nuevoSaldo <= 0 ? "pagado" : "pendiente";
    await supabase
      .from("cuentas_por_cobrar")
      .update({ estado: nuevoEstado })
      .eq("id", cuenta.id)
      .eq("user_id", user.id);

    setAbonos((prev) => [abonoData, ...prev]);
    setCuentas((prev) =>
      prev.map((item) => (item.id === cuenta.id ? { ...item, estado: nuevoEstado } : item)),
    );
    setAbonoInputs((prev) => ({ ...prev, [cuenta.id]: "" }));
    setToast("Abono registrado");
  };

  const cerrarSesion = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setVentas([]);
    setCuentas([]);
    setAbonos([]);
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
          <div className="auth-sub">Accede para registrar tus ventas en la nube.</div>
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

  if (profileLoading) return <div className="auth-wrap">Cargando perfil...</div>;

  if (!profile) {
    return (
      <>
        <div className="auth-wrap">
          <div className="header-greeting">Personaliza tu panel</div>
          <div className="auth-title">Configura tu negocio</div>
          <form className="form-body !px-0" onSubmit={guardarPerfil}>
            <div className="field-group">
              <div className="field-label">Tu nombre</div>
              <input
                className="field-input"
                type="text"
                placeholder="Ej: Yeshua"
                value={profileForm.displayName}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>
            <div className="field-group">
              <div className="field-label">Nicho de negocio</div>
              <input
                className="field-input"
                type="text"
                placeholder="Ej: Ropa femenina"
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
                placeholder="DTF, bolsa, delivery"
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

  const username = profile.display_name?.trim() || user.email?.split("@")[0] || "Usuario";

  return (
    <>
      <div className={`screen ${activeScreen === "screen-home" ? "active" : ""}`}>
        <div className="header">
          <div>
            <div className="header-greeting">Mi tienda</div>
            <div className="header-name">Hola, {username}</div>
            <div className="auth-sub">
              Nicho: {profile.business_niche} · inversion base: $
              {currency(profile.default_investment)}
            </div>
          </div>
          <div className="avatar-wrap">
            <button
              className="avatar"
              onClick={() => setAvatarMenuOpen((prev) => !prev)}
              title="Menu de usuario"
              type="button"
            >
              {(username[0] || "U").toUpperCase()}
            </button>
            {avatarMenuOpen ? (
              <div className="avatar-menu">
                <button type="button" onClick={() => goTo("screen-profile")}>
                  Perfil
                </button>
                <button type="button" onClick={cerrarSesion}>
                  Cerrar sesion
                </button>
              </div>
            ) : null}
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
                  ? `+${margen.toFixed(1)}% margen`
                  : gananciaMes === 0
                    ? "Punto de equilibrio"
                    : "Estas en perdida"}
            </span>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Vendido</div>
            <div className="stat-value green">${currency(totalVendido)}</div>
            <div className="stat-sub">
              {monthVentas.length} venta{monthVentas.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pendiente</div>
            <div className="stat-value yellow">${currency(totalPendiente)}</div>
            <div className="stat-sub">{pendientesActivos.length} por cobrar</div>
          </div>
          <div className="stat-card full">
            <div className="stat-label">Costo y extras</div>
            <div className="stat-value red">
              ${currency(totalCosto + totalExtras)}
            </div>
            <div className="stat-sub">Costo: ${currency(totalCosto)} · Extras: ${currency(totalExtras)}</div>
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
              <div className="empty-title">Nada aun</div>
              <div className="empty-sub">Registra tu primera venta tocando el boton +</div>
            </div>
          ) : (
            recent.map((v) => {
              const g = Number(v.venta || 0) - Number(v.costo || 0) - Number(v.extras || 0);
              return (
                <div className="tx-item" key={v.id}>
                  <div className="tx-info">
                    <div className="tx-name">{v.cliente || "Cliente"}</div>
                    <div className="tx-meta">
                      {v.producto} · {formatDate(v.fecha)}
                    </div>
                  </div>
                  <div className="tx-amounts">
                    <div className="tx-venta">${currency(v.venta)}</div>
                    <div className="tx-ganancia">gan. ${currency(g)}</div>
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
          <div className="form-title">Nueva venta o regalo</div>
        </div>
        <div className="form-body">
          <div className="field-group">
            <div className="field-label">Cliente</div>
            <input
              className="field-input"
              type="text"
              placeholder="Nombre del cliente"
              value={form.cliente}
              onChange={(e) => setForm((prev) => ({ ...prev, cliente: e.target.value }))}
            />
          </div>
          <div className="field-group">
            <div className="field-label">Producto</div>
            <input
              className="field-input"
              type="text"
              placeholder="Ej: Royal Text"
              value={form.producto}
              onChange={(e) => setForm((prev) => ({ ...prev, producto: e.target.value }))}
            />
          </div>
          <div className="field-row">
            <div className="field-group">
              <div className="field-label">Cantidad</div>
              <input
                className="field-input"
                type="number"
                min="1"
                placeholder="1"
                value={form.cantidad}
                onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <div className="field-label">Precio de venta $</div>
              <input
                className="field-input"
                type="number"
                min="0"
                placeholder="0.00"
                value={form.venta}
                onChange={(e) => setForm((prev) => ({ ...prev, venta: e.target.value }))}
              />
            </div>
          </div>
          <div className="field-group">
            <div className="field-label">Inversion / Costo $</div>
            <input
              className="field-input"
              type="number"
              min="0"
              placeholder={String(profile.default_investment || "0.00")}
              value={form.costo}
              onChange={(e) => setForm((prev) => ({ ...prev, costo: e.target.value }))}
            />
          </div>

          <div className="field-group">
            <div className="field-label">Extras</div>
            <button
              type="button"
              className="submit-btn"
              style={{ marginBottom: 0, padding: "12px 14px" }}
              onClick={() => setExtrasOpen((prev) => !prev)}
            >
              {extrasOpen ? "Ocultar extras" : "Agregar extras"}
            </button>
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
                      {extraOptions.find((option) => option.key === key)?.label || key} $
                    </div>
                    <input
                      className="field-input"
                      type="number"
                      min="0"
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

          <div className="field-group">
            <div className="pending-toggle">
              <input
                id="crear-pendiente"
                type="checkbox"
                checked={form.crearPendiente}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, crearPendiente: e.target.checked }))
                }
              />
              <label htmlFor="crear-pendiente">Registrar como pago pendiente</label>
            </div>
            {form.crearPendiente ? (
              <input
                className="field-input"
                type="number"
                min="0"
                max={parseFloat(form.venta) || 0}
                placeholder="Monto pendiente por cobrar"
                value={form.montoPendiente}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, montoPendiente: e.target.value }))
                }
              />
            ) : null}
          </div>

          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-key">Venta</span>
              <span className="preview-val">${currency(preview.venta)}</span>
            </div>
            <div className="preview-row">
              <span className="preview-key">Costo</span>
              <span className="preview-val">-${currency(preview.costo)}</span>
            </div>
            <div className="preview-row">
              <span className="preview-key">Extras</span>
              <span className="preview-val">-${currency(preview.extras)}</span>
            </div>
            <div className="preview-divider"></div>
            <div className="preview-row">
              <span className="preview-total-key">Ganancia</span>
              <span className={`preview-total-val ${preview.ganancia < 0 ? "loss" : ""}`}>
                {preview.ganancia < 0 ? "-" : ""}${currency(Math.abs(preview.ganancia))}
              </span>
            </div>
          </div>
          <button className="submit-btn" onClick={guardarVenta}>
            Guardar venta
          </button>
        </div>
      </div>

      <div className={`screen ${activeScreen === "screen-historial" ? "active" : ""}`}>
        <div className="historial-header">
          <h2>Historial</h2>
        </div>
        <div className="historial-list">
          {historial.map((venta) => {
            const gain =
              Number(venta.venta || 0) - Number(venta.costo || 0) - Number(venta.extras || 0);
            return (
              <div className="tx-item" key={venta.id}>
                <div className="tx-info">
                  <div className="tx-name">
                    {venta.cliente || "Cliente"} · {venta.producto}
                  </div>
                  <div className="tx-meta">
                    {formatDate(venta.fecha)} · cant: {venta.cantidad}
                  </div>
                </div>
                <div className="tx-amounts">
                  <div className="tx-venta">${currency(venta.venta)}</div>
                  <div className="tx-ganancia">${currency(gain)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`screen ${activeScreen === "screen-calendar" ? "active" : ""}`}>
        <div className="historial-header">
          <h2>Calendario</h2>
          <div className="field-group" style={{ marginTop: "12px" }}>
            <div className="field-label">Selecciona dia</div>
            <input
              className="field-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
        <div className="historial-list">
          {ventasDelDia.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">Sin registros ese dia</div>
            </div>
          ) : (
            ventasDelDia.map((venta) => (
              <div className="tx-item" key={venta.id}>
                <div className="tx-info">
                  <div className="tx-name">
                    {venta.producto} · {venta.cliente || "Cliente"}
                  </div>
                  <div className="tx-meta">Venta ${currency(venta.venta)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`screen ${activeScreen === "screen-yearly" ? "active" : ""}`}>
        <div className="historial-header">
          <h2>Panel anual</h2>
          <div className="field-group" style={{ marginTop: "12px" }}>
            <div className="field-label">Ano</div>
            <input
              className="field-input"
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            />
          </div>
        </div>
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Vendido</div>
            <div className="stat-value green">${currency(yearlyTotals.sold)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ganancia</div>
            <div className="stat-value yellow">${currency(yearlyTotals.profit)}</div>
          </div>
        </div>
        <div className="historial-list">
          {yearlyByMonth.map((row) => (
            <div className="tx-item" key={row.month}>
              <div className="tx-info">
                <div className="tx-name">{MONTHS[row.month]}</div>
                <div className="tx-meta">{row.count} ventas</div>
              </div>
              <div className="tx-amounts">
                <div className="tx-venta">${currency(row.sold)}</div>
                <div className="tx-ganancia">gan. ${currency(row.profit)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`screen ${activeScreen === "screen-pendientes" ? "active" : ""}`}>
        <div className="historial-header">
          <h2>Pendientes por cobrar</h2>
        </div>
        <div className="historial-list">
          {cuentasConSaldo.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No tienes pendientes</div>
            </div>
          ) : (
            cuentasConSaldo.map((cuenta) => (
              <div className="tx-item pending-card" key={cuenta.id}>
                <div className="tx-info">
                  <div className="tx-name">
                    {cuenta.venta?.producto || "Venta"} · {cuenta.venta?.cliente || "Cliente"}
                  </div>
                  <div className="tx-meta">
                    Total: ${currency(cuenta.monto_total)} · Abonado: ${currency(cuenta.abonado)}
                  </div>
                  <div className="tx-meta">
                    Saldo: ${currency(cuenta.saldo)} · Estado: {cuenta.estadoReal}
                  </div>
                </div>
                {cuenta.saldo > 0 ? (
                  <div className="pending-actions">
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      max={cuenta.saldo}
                      placeholder="Abono"
                      value={abonoInputs[cuenta.id] || ""}
                      onChange={(e) =>
                        setAbonoInputs((prev) => ({ ...prev, [cuenta.id]: e.target.value }))
                      }
                    />
                    <button className="submit-btn" onClick={() => registrarAbono(cuenta)}>
                      Registrar abono
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`screen ${activeScreen === "screen-profile" ? "active" : ""}`}>
        <div className="historial-header">
          <h2>Perfil</h2>
        </div>
        <div className="form-body">
          <form onSubmit={guardarPerfil} className="form-body !px-0">
            <div className="field-group">
              <div className="field-label">Tu nombre</div>
              <input
                className="field-input"
                type="text"
                value={profileForm.displayName}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>
            <div className="field-group">
              <div className="field-label">Nicho de negocio</div>
              <input
                className="field-input"
                type="text"
                value={profileForm.businessNiche}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, businessNiche: e.target.value }))
                }
              />
            </div>
            <button className="submit-btn" type="submit" disabled={savingProfile}>
              {savingProfile ? "Guardando..." : "Guardar perfil"}
            </button>
          </form>
        </div>
      </div>

      <div className="bottom-nav nav-scroll">
        <div className={`nav-item ${activeScreen === "screen-home" ? "active" : ""}`} onClick={() => goTo("screen-home")}>
          <span>Inicio</span>
        </div>
        <div className="nav-add" onClick={() => goTo("screen-form")}>
          +
        </div>
        <div className={`nav-item ${activeScreen === "screen-historial" ? "active" : ""}`} onClick={() => goTo("screen-historial")}>
          <span>Historial</span>
        </div>
        <div className={`nav-item ${activeScreen === "screen-calendar" ? "active" : ""}`} onClick={() => goTo("screen-calendar")}>
          <span>Calendario</span>
        </div>
        <div className={`nav-item ${activeScreen === "screen-yearly" ? "active" : ""}`} onClick={() => goTo("screen-yearly")}>
          <span>Anual</span>
        </div>
        <div className={`nav-item ${activeScreen === "screen-pendientes" ? "active" : ""}`} onClick={() => goTo("screen-pendientes")}>
          <span>Pendientes</span>
        </div>
      </div>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}
