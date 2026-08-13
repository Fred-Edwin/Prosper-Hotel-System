import { redirect } from "next/navigation";
import { getSession } from "@/modules/people";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.staff.role === "owner" ? "/dashboard" : "/staff");
}
