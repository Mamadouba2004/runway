import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { SummaryBar } from "@/components/SummaryBar";
import { RunwayChart } from "@/components/RunwayChart";
import { CategoryLimits } from "@/components/CategoryLimits";
import { Subscriptions } from "@/components/Subscriptions";
import { People } from "@/components/People";
import { getHomeData } from "@/lib/queries/home";
import { plaidEnv } from "@/lib/plaid/client";

// Reads live Plaid + Postgres state on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getHomeData();

  if (!data.connected) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
        <h1 className="h-sec text-[28px]">Runway</h1>
        {plaidEnv === "production" && (
          <p className="mono text-[10px] tracking-[0.14em] uppercase" style={{ color: "var(--alert)" }}>
            Production — real bank credentials
          </p>
        )}
        <PlaidLinkButton env={plaidEnv} />
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-[1440px] border-2 border-[var(--rule2)] bg-[var(--surface)]">
        <SummaryBar
          balance={data.balance}
          checkingBalance={data.checkingBalance}
          savingsBalance={data.savingsBalance}
          depositoryCount={data.depositoryCount}
          institutionName={data.institutionName}
          lastRecordedDate={data.lastRecordedDate}
          safeToSpend={data.safeToSpend}
          scheduled={data.scheduled}
          floor={data.floor}
          daysToPay={data.daysToPay}
          payDayOfMonth={data.payDayOfMonth}
          mode={data.mode}
        />

        <div className="px-5 py-2.5 border-b-2 border-[var(--rule2)] flex items-baseline gap-3.5 flex-wrap">
          <span className="mono text-[10px] tracking-[0.14em] uppercase font-semibold text-[var(--ink)]">
            {data.mode}
          </span>
          <span className="text-[12.5px] text-[var(--ink)]">
            {data.transactionCount} imported transactions
            {data.firstRecordedDate && data.lastRecordedDate
              ? ` · ${data.firstRecordedDate} → ${data.lastRecordedDate}`
              : ""}
          </span>
        </div>

        <RunwayChart
          series={data.series}
          floor={data.floor}
          monthlyBurn={data.monthlyBurn}
          subscriptionTotal={data.subscriptionTotal}
          configuredIncome={data.incomeAmount}
          observedIncome={data.observedMonthlyIncome}
          payDayOfMonth={data.payDayOfMonth}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px_380px] border-b-2 border-[var(--rule2)]">
          <CategoryLimits
            categories={data.categories}
            mode={data.mode}
            incomeAmount={data.incomeAmount}
          />
          <Subscriptions
            subscriptions={data.subscriptions}
            total={data.subscriptionTotal}
            incomeAmount={data.incomeAmount}
          />
          <People people={data.people} />
        </div>
      </div>
    </main>
  );
}
