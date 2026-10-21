import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { auth } from "@/lib/auth";


export default async function NewSubscriptionPage() {
const session = await auth();
if (!session?.user?.id) {
  redirect("/auth/signin");
}

return (
<div className="mx-auto max-w-2xl space-y-6">
<h1 className="text-2xl font-semibold">Add subscription</h1>
<Card>
<SubscriptionForm />
</Card>
</div>
);
}