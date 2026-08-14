import { createFileRoute } from '@tanstack/react-router'
import { PaymentResultPage } from '@/features/payment/payment-result-page'

export const Route = createFileRoute('/(product)/payment-success')({
  component: () => <PaymentResultPage mode="success" />,
})
