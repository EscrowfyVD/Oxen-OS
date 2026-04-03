import { redirect } from "next/navigation"
export default function OldAgentDetailPage({ params }: { params: { id: string } }) {
  redirect(`/crm/contacts/${params.id}`)
}
