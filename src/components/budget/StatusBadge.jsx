import { statusLabels } from '../../data/budgetStatus'

const statusClasses = {
  accepted: 'bg-[#ecfdf3] text-[#166534] border-[#bbf7d0]',
  draft: 'bg-[#f3f4f6] text-[#374151] border-[#d1d5db]',
  rejected: 'bg-[#fff5f5] text-[#991b1b] border-[#fecaca]',
  sent: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        statusClasses[status] || statusClasses.draft
      }`}
    >
      {statusLabels[status] || statusLabels.draft}
    </span>
  )
}

export default StatusBadge
