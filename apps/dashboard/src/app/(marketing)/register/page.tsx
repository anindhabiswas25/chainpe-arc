import type { Metadata } from 'next'
import RegisterService from '@/components/app/RegisterService'

export const metadata: Metadata = {
  title: 'Register a service | ChainPe on Arc Testnet',
  description: 'List an x402 API in the ChainPeRegistry on Arc Testnet: approve the USDC fee, register, edit or deregister.',
}

export default function RegisterPage() {
  return (
    <section className="section app-page">
      <div className="container">
        <h1 className="section-title">Register a service</h1>
        <p className="section-description">
          List your x402 endpoint in the ChainPeRegistry so agents can discover it. Registration costs a one-off USDC
          fee; gas on Arc is also paid in USDC.
        </p>
        <RegisterService />
      </div>
    </section>
  )
}
