import { redirect } from "next/navigation";

// /manage has no view of its own. Every visit shows the sign-in page, where the person chooses a view.
export default function ManageIndex() {
  redirect("/login");
}
