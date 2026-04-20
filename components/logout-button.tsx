"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LogoutButtonProps = {
  iconOnly?: boolean;
};

export function LogoutButton({ iconOnly = false }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={onLogout}
      className={iconOnly ? "btn-ghost--icon" : "btn-ghost w-full"}
      disabled={loading}
      title="Cerrar sesion"
      aria-label="Cerrar sesion"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      {!iconOnly && <span className="ml-2">{loading ? "Saliendo..." : "Cerrar sesion"}</span>}
    </button>
  );
}
