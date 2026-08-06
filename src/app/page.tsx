import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listGroupsOfUser } from "@/lib/queries";
import Dashboard from "./Dashboard";
import TabBar from "@/components/TabBar";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  const groups = listGroupsOfUser(user.id);

  return (
    <>
      <Dashboard user={user} groups={groups} />
      <TabBar />
    </>
  );
}
