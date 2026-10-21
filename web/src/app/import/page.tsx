import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ImportClient from "./ImportClient";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  return <ImportClient />;
}
