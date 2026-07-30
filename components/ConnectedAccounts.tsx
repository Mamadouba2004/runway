import type { LinkedAccount } from "@/lib/plaid/accounts";

export function ConnectedAccounts({
  accounts,
  env,
}: {
  accounts: LinkedAccount[];
  env: "sandbox" | "production";
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">
        Connected accounts{env === "sandbox" ? " (sandbox)" : ""}:
      </p>
      <ul className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
        {accounts.map((account) => (
          <li key={`${account.name}-${account.mask}`}>
            {account.name} •••• {account.mask ?? "----"} (
            {account.subtype ?? account.type})
          </li>
        ))}
      </ul>
    </div>
  );
}
