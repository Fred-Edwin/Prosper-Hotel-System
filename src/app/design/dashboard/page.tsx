import { redirect } from "next/navigation";

/**
 * The dashboard now lives at `/design/shell`, inside the settled admin shell.
 *
 * This route existed to compare the round-two and round-three variants against
 * each other; those are gone, and a dashboard judged outside its frame is
 * exactly the vacuum the design phase closed. Redirects rather than 404s
 * because the old URL is in the design spec and in the conversation history.
 */
export default function DashboardPage() {
  redirect("/design/shell");
}
