import { notFound, redirect } from "next/navigation";
import { getSubscriptionById } from "@/server/storage";
import { Card } from "@/components/Card";
import { EditSubscriptionForm } from "@/components/EditSubscriptionForm";
import { auth } from "@/lib/auth";

export default async function EditSubPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const { id } = await params;
  const sub = await getSubscriptionById(session.user.id, id);
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
