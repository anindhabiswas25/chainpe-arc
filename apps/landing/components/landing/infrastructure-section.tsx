"use client";

import { useEffect, useState, useRef } from "react";

const locations = [
  { city: "Arc Testnet", region: "Settlement network", latency: "chain 5042002" },
  { city: "ChainPeRegistry + PolicyVault", region: "Deployed contracts", latency: "live" },
  { city: "Your facilitator", region: "x402 verify + settle", latency: "self-hosted" },
  { city: "Your indexer (optional)", region: "Discovery API", latency: "self-hosted" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLocation((prev) => (prev + 1) % locations.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Infrastructure
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              USDC-native
              <br />
              by design.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              Payments settle in Circle USDC on Arc Testnet, where{" "}
              <a
                href="https://docs.arc.io/arc/concepts/stable-fee-design"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                USDC is also the gas token
              </a>{" "}
              — agents only ever hold one asset.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">USDC</div>
                <div className="text-sm text-muted-foreground">Gas + payment token</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">EIP-3009</div>
                <div className="text-sm text-muted-foreground">Gasless authorizations</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">x402</div>
                <div className="text-sm text-muted-foreground">HTTP 402 payments</div>
              </div>
            </div>
          </div>

          {/* Right: Location list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Components</span>
                <span className="text-xs font-mono text-muted-foreground">Arc Testnet only</span>
              </div>

              {/* Locations */}
              <div>
                {locations.map((location, index) => (
                  <div
                    key={location.city}
                    className={`px-6 py-5 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${
                      activeLocation === index ? "bg-foreground/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span 
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          activeLocation === index ? "bg-foreground" : "bg-foreground/20"
                        }`}
                      />
                      <div>
                        <div className="font-medium">{location.city}</div>
                        <div className="text-sm text-muted-foreground">{location.region}</div>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">{location.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
