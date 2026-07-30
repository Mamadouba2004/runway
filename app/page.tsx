import Link from "next/link";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";
import { SummaryBar } from "@/components/SummaryBar";
import { RunwayChart } from "@/components/RunwayChart";
import { CategoryLimits } from "@/components/CategoryLimits";
import { Subscriptions } from "@/components/Subscriptions";
import { People } from "@/components/People";
import { ReferenceSection } from "@/components/ReferenceSection";
import { SyncNowButton } from "@/components/SyncNowButton";
import { getHomeData } from "@/lib/queries/home";
import { plaidEnv } from "@/lib/plaid/client";
import { money } from "@/lib/format";

// Reads live Plaid + Postgres state on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getHomeData();

  if (!data.connected) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
        <h1 className="h-sec text-[28px]">Runway</h1>
        {plaidEnv === "production" && (
          <p
            className="mono text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--alert)" }}
          >
            Production — real bank credentials
          </p>
        )}
        <PlaidLinkButton env={plaidEnv} />
      </main>
    );
  }

  const capped = data.categories.filter((c) => c.cap !== null);
  const overCap = capped.filter((c) => c.over);
  const activeSubs = data.subscriptions.filter((s) => s.isActive);
  const supported = data.people.filter((p) => p.owed > 0);
  const totalSupported = supported.reduce((s, p) => s + p.owed, 0);

  return (
    <main className="p-6">
      <div className="mx-auto max-w-[1440px] border-2 border-[var(--rule2)] bg-[var(--surface)]">
        {/* --- Tier 1: the decision -------------------------------------- */}
        <SummaryBar
          balance={data.balance}
          checkingBalance={data.checkingBalance}
          savingsBalance={data.savingsBalance}
          depositoryCount={data.depositoryCount}
          institutionName={data.institutionName}
          safeToSpend={data.safeToSpend}
          scheduled={data.scheduled}
          floor={data.floor}
          daysToPay={data.daysToPay}
          nextPayday={data.nextPayday}
          cadence={data.cadence}
          mode={data.mode}
        />

        {/* --- Tier 2: the trajectory -------------------------------------
            Given more room than anything else here; it is the only element
            that rewards study rather than a glance. */}
        <div className="px-2 py-3 border-b-2 border-[var(--rule2)]">
          <RunwayChart
            series={data.series}
            floor={data.floor}
            monthlyBurn={data.monthlyBurn}
            subscriptionTotal={data.subscriptionTotal}
            observedPerPaycheck={data.incomeAmount}
            capPerPaycheck={data.incomeStats.cap}
            paychecksPerYear={data.cadence === "biweekly" ? 26 : 12}
            incomeConfidence={data.incomeStats.confidence}
            incomeSampleSize={data.incomeStats.count}
            paydayDates={data.paydayDates}
            band={data.band}
          />
        </div>

        {/* --- Tier 3: reference, collapsed -------------------------------- */}
        <ReferenceSection
          title="Limits"
          headline={capped.length > 0 ? `${overCap.length}/${capped.length} over` : "no caps"}
          hint={
            capped.length > 0
              ? `${data.mode} · ${capped.length} capped · ${data.categories.length - capped.length} without`
              : `${data.categories.length} categories, none capped`
          }
          accent={overCap.length > 0 ? "var(--alert)" : undefined}
        >
          <CategoryLimits
            categories={data.categories}
            mode={data.mode}
            incomeAmount={data.incomeAmount}
          />
        </ReferenceSection>

        <ReferenceSection
          title="Subscriptions"
          headline={`${money(data.subscriptionTotal)}/mo`}
          hint={`${activeSubs.length} active · ${data.subscriptions.length - activeSubs.length} inactive`}
        >
          <Subscriptions
            subscriptions={data.subscriptions}
            total={data.subscriptionTotal}
            incomeAmount={data.incomeAmount}
          />
        </ReferenceSection>

        <ReferenceSection
          title="People"
          headline={money(totalSupported)}
          hint={`${supported.length} supported · ${data.people.length} from Zelle`}
          accent="var(--c-people)"
        >
          <People people={data.people} />
        </ReferenceSection>

        {/* --- Footer: provenance and controls ----------------------------- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 border-t-2 border-[var(--rule2)]">
          <SyncNowButton lastSyncedAt={data.lastSyncedAt} />
          <Link
            href="/profile"
            className="btn btn-off border border-[var(--rule)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em]"
          >
            Profile
          </Link>
          <span className="mono text-[9.5px] text-[var(--faint)]">
            {data.transactionCount} transactions
            {data.firstRecordedDate && data.lastRecordedDate
              ? ` · ${data.firstRecordedDate} → ${data.lastRecordedDate}`
              : ""}
          </span>
        </div>
      </div>
    </main>
  );
}
