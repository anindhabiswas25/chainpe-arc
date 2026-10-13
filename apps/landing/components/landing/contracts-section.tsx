import { ArrowUpRight } from "lucide-react";
import {
  ARC_CHAIN_ID,
  CHAINPE_CONTRACTS,
  DASHBOARD_URL,
  ERC8004_CONTRACTS,
  EXPLORER_URL,
  addressUrl,
  type LiveContract,
} from "@/lib/chainpe";

function ContractRow({ contract }: { contract: LiveContract }) {
  return (
    <a
      href={addressUrl(contract.address)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block px-6 py-5 border-b border-foreground/5 last:border-b-0 hover:bg-foreground/[0.02] transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">{contract.name}</div>
          <div className="font-mono text-xs sm:text-sm text-muted-foreground break-all mt-1">{contract.address}</div>
          <div className="text-sm text-muted-foreground mt-2">{contract.role}</div>
          <div className="font-mono text-xs text-muted-foreground/80 mt-1">{contract.source}</div>
        </div>
        <ArrowUpRight className="w-4 h-4 shrink-0 mt-1 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </a>
  );
}

function ContractList({ title, note, contracts }: { title: string; note: string; contracts: LiveContract[] }) {
  return (
    <div className="border border-foreground/10">
      <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between gap-4">
        <span className="text-sm font-mono text-muted-foreground">{title}</span>
        <span className="text-xs font-mono text-muted-foreground text-right">{note}</span>
      </div>
      {contracts.map((c) => (
        <ContractRow key={c.address} contract={c} />
      ))}
    </div>
  );
}

export function ContractsSection() {
  return (
    <section id="contracts" className="relative py-24 lg:py-32 border-t border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 max-w-3xl">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Live on Arc Testnet
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
            {CHAINPE_CONTRACTS.length} contracts deployed.
            <br />
            <span className="text-muted-foreground">Check them yourself.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            ChainPe runs on Arc Testnet (chain {ARC_CHAIN_ID}), where USDC is the gas token. Every address below
            opens in the{" "}
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Arc Testnet explorer
            </a>
            . This is a testnet deployment: contracts are owned by the deployer key and have had no third-party audit.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <ContractList title="ChainPe" note="deployed 2026-10-13" contracts={CHAINPE_CONTRACTS} />
          <ContractList title="ERC-8004" note="Arc canonical, v2.0.0" contracts={ERC8004_CONTRACTS} />
        </div>

        {DASHBOARD_URL && (
          <div className="mt-10 flex flex-wrap gap-6 text-sm">
            <a href={`${DASHBOARD_URL}/network`} className="text-foreground hover:underline underline-offset-4">
              Live contract state
            </a>
            <a href={`${DASHBOARD_URL}/register`} className="text-muted-foreground hover:text-foreground">
              Register a service
            </a>
            <a href={`${DASHBOARD_URL}/vault`} className="text-muted-foreground hover:text-foreground">
              Fund an agent budget
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
