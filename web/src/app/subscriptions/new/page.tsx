import { Card } from "@/components/Card";
import { SubscriptionForm } from "@/components/SubscriptionForm";


export default function NewSubscriptionPage() {
return (
<div className="mx-auto max-w-2xl space-y-6">
<h1 className="text-2xl font-semibold">Add subscription</h1>
<Card>
<SubscriptionForm />
</Card>
</div>
);
}