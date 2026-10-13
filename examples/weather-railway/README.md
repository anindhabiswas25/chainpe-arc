# weather-railway — deployable backend

The same zero-dependency weather backend as [`../weather-api`](../weather-api),
packaged for deploying on its own (Railway, Docker or any Node host). It needs
no environment variables beyond `PORT`.

```bash
cd examples/weather-railway
npm start                 # :3001, or $PORT
```

Then deploy [`../proxy-railway`](../proxy-railway) with `TARGET_URL` set to
this service's URL and `CHAINPE_FACILITATOR_URL` set to your self-hosted
facilitator to charge USDC on Arc Testnet per request.
