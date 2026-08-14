import { createFileRoute } from '@tanstack/react-router'
import { PaymentResultPage } from '@/features/payment/payment-result-page'

export const Route = createFileRoute('/$lang/(product)/payment-cancel')({
  component: () => <PaymentResultPage mode="cancel" />,
})
