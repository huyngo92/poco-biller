import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listGroupsOfUser } from "@/lib/queries";
import BillHistory from "./BillHistory";
import TabBar from "@/components/TabBar";

export default async function BillPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  const groups = listGroupsOfUser(user.id);

  return (
    <>
      <BillHistory user={user} groups={groups} />
      <TabBar />
    </>
  );
}
