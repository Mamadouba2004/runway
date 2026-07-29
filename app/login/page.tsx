import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  issueSession,
  passwordMatches,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";

  const secret = process.env.AUTH_SECRET;
  const expected = process.env.AUTH_PASSWORD;
  if (!secret || !expected) redirect("/login?error=config");

  const candidate = formData.get("password");
  if (typeof candidate !== "string" || !(await passwordMatches(candidate, expected))) {
    // Deliberately generic — no hint about whether the field was empty,
    // too short, or simply wrong.
    redirect("/login?error=1");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await issueSession(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-10">
      <div className="w-full max-w-[380px] border-2 border-[var(--rule2)] bg-[var(--surface)]">
        <div className="px-5 py-4 border-b-2 border-[var(--rule2)]">
          <h1 className="h-sec text-[19px]">Runway</h1>
          <p className="mono text-[10px] text-[var(--muted)] mt-1.5 tracking-[0.12em] uppercase">
            Private — passphrase required
          </p>
        </div>

        <form action={login} className="px-5 py-5 flex flex-col gap-3">
          <label className="label" htmlFor="password">
            Passphrase
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className="input text-[14px] w-full"
          />
          {error === "config" ? (
            <p className="mono text-[11px]" style={{ color: "var(--alert)" }}>
              AUTH_SECRET / AUTH_PASSWORD are not configured on the server.
            </p>
          ) : error ? (
            <p className="mono text-[11px]" style={{ color: "var(--alert)" }}>
              Incorrect passphrase.
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-on px-4 py-2.5 text-[10.5px] tracking-[0.1em] uppercase min-h-[38px] mt-1"
          >
            Unlock
          </button>
        </form>
      </div>
    </main>
  );
}
