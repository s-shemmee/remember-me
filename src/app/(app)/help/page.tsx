import { redirect } from "next/navigation";

/**
 * An old placeholder from the first app shell. Help & feedback has lived in
 * Settings (and the account menu, as a mailto link) since M5 part 1, so this
 * address just goes there.
 */
export default function Page() {
  redirect("/settings#help");
}
