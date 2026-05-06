"use client";

import Link from "next/link";
import { useMemo } from "react";

function getParams(source) {
  const params = new URLSearchParams(source);
  const out = {};
  for (const [key, value] of params.entries()) out[key] = value;
  return out;
}

export default function VerifiedPage() {
  const state = useMemo(() => {
    if (typeof window === "undefined") {
      return { ok: true, title: "Verificacion exitosa", desc: "Tu cuenta ya quedo verificada." };
    }

    const query = getParams(window.location.search);
    const hash = getParams(window.location.hash.replace(/^#/, ""));
    const all = { ...query, ...hash };

    const hasError = Boolean(all.error || all.error_code || all.error_description);
    if (hasError) {
      return {
        ok: false,
        title: "No se pudo verificar",
        desc: decodeURIComponent(
          all.error_description || all.error || "El enlace vencio o no es valido.",
        ),
      };
    }

    return {
      ok: true,
      title: "Verificacion exitosa",
      desc: "Tu correo fue confirmado. Ya puedes iniciar sesion en Mi tienda.",
    };
  }, []);

  return (
    <div className="auth-wrap verified-wrap">
      <div className={`verified-icon ${state.ok ? "ok" : "bad"}`}>{state.ok ? "✓" : "!"}</div>
      <div className="auth-title">{state.title}</div>
      <div className="auth-sub">{state.desc}</div>
      <Link className="submit-btn" href="/">
        Ir al login
      </Link>
    </div>
  );
}
