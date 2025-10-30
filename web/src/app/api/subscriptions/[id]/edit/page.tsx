import { notFound } from "next/navigation";
import { getSubscriptionById } from "@/server/storage";
import { Card } from "@/components/Card";
import { EditSubscriptionForm } from "@/components/EditSubscriptionForm";

type Props = { params: { id: string } };

export default async function EditSubPage({ params }: Props) {
  const sub = await getSubscriptionById(params.id);
  if (!sub) return notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit subscription</h1>
      <Card>
        <EditSubscriptionForm initial={sub} />
      </Card>
    </div>
  );
}
