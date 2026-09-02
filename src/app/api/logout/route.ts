import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function POST() {
  const jar = await cookies();
  // Must clear every auth cookie, not just "societe" — leaving "role"/"userId" behind after
  // logout would let a stale admin-role cookie survive the session (security audit finding).
  jar.delete("societe");
  jar.delete("role");
  jar.delete("userId");
  redirect("/login");
}
