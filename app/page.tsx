import Image from "next/image";

export default function Index() {
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

        <form className="mt-8 space-y-5">
          <label className="flex items-center gap-4">
            <span className="w-10 shrink-0 text-lg font-medium text-slate-700">帳號</span>
            <input
              type="text"
              placeholder="帳號"
              className="flex-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex items-center gap-4">
            <span className="w-10 shrink-0 text-lg font-medium text-slate-700">密碼</span>
            <input
              type="password"
              placeholder="密碼"
              className="flex-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="button"
            className="mt-10 w-full mx-auto block rounded-lg bg-[#007F83] py-3 font-medium text-white transition hover:bg-[#55AFB9]"
          >
            登入
          </button>
        </form>
      </section>
    </main>
  );
}
