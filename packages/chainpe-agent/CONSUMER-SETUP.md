# ChainPe Consumer Developer Setup

**Build AI agents that can autonomously discover, pay for, and use monetized APIs with real USDC payments.**

---

## 🚀 5-Minute Setup

### Step 1: Install ChainPe Agent

```bash
npm install -g @chainpearc/agent      # CLI
npm install @chainpearc/agent         # or as a library in your project
```

> `@chainpearc/*` is not published to npm yet. Until it is, build this repo (`npm install && npm run build`) and install by path: `npm install -g /path/to/ChainPe/packages/chainpe-agent`.

### Step 2: Get a Free LLM API Key

We recommend **Groq** for the free tier with fast inference:

1. Visit https://console.groq.com/
2. Sign up for free account
3. Go to API Keys section
4. Click "Create API Key"
5. Copy your key (starts with `gsk_...`)

**Alternative LLM Providers:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/
- Google AI: https://aistudio.google.com/app/apikey
- Local Ollama: Install from https://ollama.com/

### Step 3: Get USDC

Get testnet USDC from the Circle faucet: <https://faucet.circle.com> (select Arc Testnet). USDC is also the gas token on Arc.

1. Generate a new EVM wallet OR use an existing one
2. Request testnet USDC from <https://faucet.circle.com> (select Arc Testnet) for your address

**Need a new wallet?** You can generate one during the setup process or use any EVM wallet app (e.g. MetaMask with the Arc Testnet network added).

> **Testnet:** For Arc Testnet development only, use the Circle faucet: https://faucet.circle.com (select Arc Testnet)

### Step 4: Initialize Your Agent

```bash
chainpe-agent init
```

The interactive setup will guide you through:

```
◆  LLM Mode                         API (OpenAI/Anthropic/Gemini/Groq)
◆  LLM Provider                     Groq
◆  Model                            qwen/qwen3-32b
◆  groq API Key                     gsk_…
◆  Network                          Arc Testnet
◆  Wallet                           Import an existing private key  (or: Generate a new wallet)
◆  Wallet private key (0x…)         ••••••
✔ Wallet: 0x1c01…e794
✔ Wallet securely stored in OS keychain
✔ Balance: 10 USDC
◆  ChainPe Registry contract address (optional)   (blank = live Arc Testnet registry)
◆  Local registry cache path        ~/.chainpe/registry.json
```

The private key goes into the OS keychain, never into `~/.chainpe/agent.json`.
`chainpe-agent services` then lists what is on the live registry
(`0x79c7a22993A40A3c88355b737e6F608c6610c395`).

### Step 5: Test Your Agent!

```bash
chainpe-agent run "Get weather for London"
```

The agent can only buy from services that are registered **and reachable**. Check
with `chainpe-agent services`; to try the whole loop locally, run the provider
side from [`packages/chainpe/PROVIDER-SETUP.md`](../chainpe/PROVIDER-SETUP.md)
(weather backend + `chainpe start` + `chainpe register`).

**Example output:**
```
✓ Task completed

Here is the current weather information for London:
- Temperature: 58°F  
- Condition: Rainy 🌧️  
- Humidity: 85%  
- Wind Speed: 15 mph  

  Payments:
    Transactions: 1
    Total USDC:   0.05
```

Your agent just discovered a service, paid 0.05 USDC, and got the data - all automatically! 🎉

---

## 📖 CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `chainpe-agent init` | Interactive setup wizard | `chainpe-agent init` |
| `chainpe-agent status` | Show config, wallet balance | `chainpe-agent status` |
| `chainpe-agent services` | List available paid services | `chainpe-agent services` |
| `chainpe-agent run <task>` | Execute a task | `chainpe-agent run "analyze data"` |
| `chainpe-agent run <task> --provider <name>` | Use specific service | `chainpe-agent run "get weather" --provider Weather` |
| `chainpe-agent run <task> --verbose` | Show payment details | `chainpe-agent run "task" --verbose` |

---

## 💻 SDK Usage (Programmatic)

### Basic Usage

```typescript
import { ChainPeAgent } from "@chainpearc/agent";

// Create agent (reads config from ~/.chainpe/agent.json)
const agent = new ChainPeAgent();

// Run a task
const result = await agent.run("Get weather for Tokyo");

console.log(result.text);
console.log(`Spent: ${result.payments.totalSpent.USDC} USDC`);
```

### Advanced Usage with Options

```typescript
import { ChainPeAgent } from "@chainpearc/agent";

const agent = new ChainPeAgent();

// Run with options
const result = await agent.run(
  "Find a research service and summarize quantum computing",
  {
    maxSteps: 10,
    verbose: true,
    onPayment: (receipt) => {
      console.log(`💰 Paid ${receipt.amount} ${receipt.token} to ${receipt.service}`);
      console.log(`   Transaction: ${receipt.txId}`);
    },
    onStep: (step) => {
      if (step.toolName) console.log(`🔧 Using tool: ${step.toolName}`);
    }
  }
);

// Check results
console.log("Response:", result.text);
console.log("Steps taken:", result.steps.length);
console.log("Total payments:", result.payments.transactionCount);
console.log("Total USDC spent:", result.payments.totalSpent.USDC);
```

### Custom Configuration

```typescript
import { ChainPeAgent } from "@chainpearc/agent";

// Pass a config object instead of reading ~/.chainpe/agent.json
const agent = new ChainPeAgent({
  config: {
    llm: {
      mode: "api",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      apiKey: process.env.GROQ_API_KEY!
    },
    wallet: {
      address: "0xYourWalletAddress", // the key is read from the OS keychain (stored during setup)
      useKeychain: true
    },
    payment: { preferredToken: "USDC" },
    network: "arc-testnet"
  }
});

const result = await agent.run("Get weather data");
```

### Listing Available Services

```typescript
import { ChainPeAgent } from "@chainpearc/agent";

const agent = new ChainPeAgent();

// List all services
const services = await agent.listServices();

services.forEach(service => {
  console.log(`${service.name}: ${service.description}`);
  console.log(`  Endpoint: ${service.endpoint}`);
  console.log(`  Price: ${service.pricePerRequest} ${service.paymentToken}`);
  console.log(`  Tags: ${service.tags.join(", ")}`);
  console.log();
});
```

---

## 🔧 Configuration Reference

### Config File Location

`~/.chainpe/agent.json`

### Config Structure

```typescript
{
  llm: {
    mode: "api" | "local",           // Cloud API or local Ollama
    provider: "groq" | "openai" | "anthropic" | "gemini",
    model: string,                    // Model name
    apiKey: string,                   // API key (not needed for local)
    baseURL?: string                  // Optional custom endpoint
  },
  wallet: {
    address: string,                  // 0x wallet address; its private key lives in the OS keychain
    useKeychain?: boolean             // default true
  },
  payment: {
    preferredToken: "USDC",           // the only payment token
    maxPricePerRequest?: string        // optional per-call cap (USDC)
  },
  network?: "arc-testnet",          // the only supported network (default)
  registryAddress?: string,          // ChainPeRegistry override; defaults to the live 0x79c7a229…c395
  reputationRegistry?: string,       // ERC-8004 Reputation Registry
  registryPath?: string               // Custom registry location
}
```

### Supported Models

**Groq (Free Tier):**
- `llama-3.3-70b-versatile` - Best reasoning, slower
- `qwen/qwen3-32b` - Fast inference (recommended)
- `mixtral-8x7b-32768` - Good balance

**OpenAI:**
- `gpt-4o` - Most capable
- `gpt-4-turbo` - Fast GPT-4
- `gpt-3.5-turbo` - Fastest, cheapest

**Anthropic:**
- `claude-3-5-sonnet-20241022` - Most capable
- `claude-3-opus-20240229` - Best reasoning
- `claude-3-sonnet-20240229` - Balanced

**Google Gemini:**
- `gemini-2.0-flash-exp` - Fastest
- `gemini-1.5-pro` - Most capable

**Local Ollama:**
- `qwen2.5:7b` - Recommended for local
- `llama3.2:3b` - Lightweight
- Any model available in Ollama

---

## 🎯 Example Agent Scripts

### Weather Query Agent

```typescript
// weather-agent.ts
import { ChainPeAgent } from "@chainpearc/agent";

const agent = new ChainPeAgent();

const cities = ["London", "Paris", "Tokyo", "New York", "Dubai"];

for (const city of cities) {
  console.log(`\n🌍 Getting weather for ${city}...`);
  
  const result = await agent.run(
    `Get current weather for ${city}`,
    { verbose: false }
  );
  
  console.log(result.text);
  console.log(`💰 Spent: ${result.payments.totalSpent.USDC} USDC`);
}

console.log("\n✅ All queries completed!");
```

Run with:
```bash
npx tsx weather-agent.ts
```

### Research Assistant Agent

```typescript
// research-agent.ts
import { ChainPeAgent } from "@chainpearc/agent";

const agent = new ChainPeAgent();

const topics = [
  "Latest developments in quantum computing",
  "Climate change impact on agriculture",
  "Advances in gene therapy"
];

for (const topic of topics) {
  console.log(`\n📚 Researching: ${topic}`);
  
  const result = await agent.run(
    `Find research services and summarize: ${topic}`,
    { maxSteps: 5 }
  );
  
  console.log(result.text);
  console.log(`\nPayments: ${result.payments.transactions.length} transactions`);
}
```

### Multi-Service Agent

```typescript
// multi-service-agent.ts
import { ChainPeAgent } from "@chainpearc/agent";

const agent = new ChainPeAgent();

async function runTask(task: string) {
  console.log(`\n🤖 Task: ${task}`);
  
  const result = await agent.run(task, {
    verbose: true,
    onPayment: (receipt) => {
      console.log(`  💳 Payment: ${receipt.amount} ${receipt.token}`);
    }
  });
  
  console.log(`\n📝 Result: ${result.text}`);
  console.log(`💰 Total spent: ${result.payments.totalSpent.USDC} USDC`);
}

// Run multiple tasks
await runTask("Get weather for San Francisco");
await runTask("Find news about AI and blockchain");
await runTask("Get stock data for AAPL");

console.log("\n✅ All tasks completed!");
```

---

## 🔐 Security Best Practices

### Wallet Security

1. **Never commit your private key** to version control
2. **Keep the key in the OS keychain** (the default after setup); don't paste it into code or config files
3. **Use a dedicated, low-balance wallet** - fund it with only the USDC the agent should be able to spend
4. **Monitor wallet balance** to prevent unauthorized spending

### API Key Security

1. **Never commit API keys** to repositories
2. **Use environment variables**:
   ```bash
   export GROQ_API_KEY="gsk_..."
   ```
3. **Rotate keys regularly**
4. **Set spending limits** on your LLM provider dashboard

### Example: Secure Configuration

```typescript
import { ChainPeAgent } from "@chainpearc/agent";

const agent = new ChainPeAgent({
  config: {
    llm: {
      mode: "api",
      provider: "groq",
      model: "qwen/qwen3-32b",
      apiKey: process.env.GROQ_API_KEY!, // From env var
    },
    wallet: { address: "0xYourWalletAddress", useKeychain: true }, // key stays in the OS keychain
    payment: { preferredToken: "USDC" },
    network: "arc-testnet"
  }
});
```

---

## 🐛 Troubleshooting

### "API key is invalid"
- Check your API key is correct
- Verify you're using the right provider (groq/openai/anthropic)
- Regenerate key if needed

### "Invalid private key"
- It must be a 32-byte hex key: `0x` followed by 64 hex characters
- Check for typos or stray spaces

### "Insufficient balance"
- Get testnet USDC from https://faucet.circle.com (select Arc Testnet); USDC also pays gas
- Check balance: `chainpe-agent status`
- Minimum 0.1 USDC recommended

### "Service not found"
- Check services: `chainpe-agent services`
- Verify service is registered
- Try without `--provider` flag to auto-discover

### "Payment failed"
- Check wallet has sufficient USDC
- Verify network connectivity
- Check service is accepting payments

---

## 📚 Next Steps

1. **Build your first agent** - Start with simple queries
2. **Explore available services** - `chainpe-agent services`
3. **Create custom workflows** - Combine multiple service calls
4. **Share what you build** - Arc Testnet is the only supported network today

## 🤝 Need Help?

- Arc Testnet reference: [`ARC_INTEGRATION.md`](../../ARC_INTEGRATION.md)
- Live addresses and example transactions: [`docs/DEPLOYMENTS.md`](../../docs/DEPLOYMENTS.md)

---

**Happy Building! 🚀**

ChainPe makes it easy for AI agents to autonomously discover and pay for services using real blockchain micropayments.
