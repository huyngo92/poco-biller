import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listGroupsOfUser } from "@/lib/queries";
import AddBill from "./AddBill";
import TabBar from "@/components/TabBar";

export default async function AddBillPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  const groups = listGroupsOfUser(user.id);
  if (groups.length === 0) redirect("/cai-dat");

  return (
    <>
      <AddBill user={user} groups={groups} />
      <TabBar />
    </>
  );
}
