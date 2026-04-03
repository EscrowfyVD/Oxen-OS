import { redirect } from "next/navigation"
export default function OldCrmDetailPage({ params }: { params: { id: string } }) {
  redirect(`/crm/contacts/${params.id}`)
}
