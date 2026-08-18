import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function POST() {
  const jar = await cookies();
  jar.delete("societe");
  redirect("/login");
}
