"use client";

import { ArrowRight, Check } from "lucide-react";

const plans = [
  {
    name: "Arc Testnet",
    description: "For development and testing",
    price: "Free",
    period: "testnet",
    features: [
      "Arc Testnet (chain 5042002)",
      "Testnet USDC from the Circle faucet",
      "Local facilitator for development",
      "Open-source SDK, CLI and MCP server",
      "Full API access",
    ],
    cta: "Start building",
    href: "/docs/getting-started/quickstart",
    popular: false,
  },
  {
    name: "Self-Hosted",
    description: "Run your own facilitator",
    price: "$0",
    period: "facilitator fees",
    features: [
      "Non-custodial x402 verify + settle",
      "Settlement gas paid in USDC",
      "Docker image or plain Node service",
      "Health, status and Prometheus metrics",
      "Optional self-hosted indexer",
    ],
    cta: "Self-hosting guide",
    href: "/docs/self-hosting/facilitator",
    popular: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-32 lg:py-40 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            Pricing
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Pay per request.
            <br />
            <span className="text-stroke">No subscriptions.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            A sustainable model for the agent economy. Only pay when your agents successfully transact.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-px bg-foreground/10">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`relative p-8 lg:p-12 bg-background ${
                plan.popular ? "md:-my-4 md:py-12 lg:py-16 border-2 border-foreground" : ""
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-foreground text-primary-foreground text-xs font-mono uppercase tracking-widest">
                  Recommended
                </span>
              )}

              {/* Plan Header */}
              <div className="mb-8">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-3xl text-foreground mt-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-foreground/10">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={plan.href}
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  plan.popular
                    ? "bg-foreground text-primary-foreground hover:bg-foreground/90"
                    : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Note: Network gas fees (paid in USDC on Arc Testnet) still apply.{" "}
          <a href="https://docs.arc.io/arc/concepts/stable-fee-design" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Read fee mechanics
          </a>
        </p>
      </div>
    </section>
  );
}
