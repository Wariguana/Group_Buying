"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function Index() {

  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = (await response.json()) as { message?: string };

      if (response.ok) {
        router.replace("/home");
        router.refresh();
        return;
      }

      setErrorMessage(data.message ?? "登入失敗，請稍後再試。");
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat p-6"
      style={{ backgroundImage: "url('/S__70303751.jpg')" }}
    >
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <Image
            className="mx-auto w-[150px] h-auto"
            src="/Millionlogo.png"
            alt="台糖蜜鄰 Logo"
            width={100}
            height={100}
            priority
          />
        </div>

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          <label className="flex items-center gap-4">
            <span className="w-10 shrink-0 text-lg font-medium text-slate-700">帳號</span>
            <input
              type="text"
              placeholder="帳號"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="text-black flex-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex items-center gap-4">
            <span className="w-10 shrink-0 text-lg font-medium text-slate-700">密碼</span>
            <input
              type="password"
              placeholder="密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="text-black flex-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-10 block w-full rounded-lg bg-[#007F83] py-3 font-medium text-white transition hover:bg-[#55AFB9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "登入中…" : "登入"}
          </button>
        </form>
      </section>
    </main>
  );
}
