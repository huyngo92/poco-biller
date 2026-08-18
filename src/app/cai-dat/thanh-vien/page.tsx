import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listGroupsOfUser } from "@/lib/queries";
import GroupMembers from "./GroupMembers";
import TabBar from "@/components/TabBar";

export default async function GroupMembersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  const groups = listGroupsOfUser(user.id);

  return (
    <>
      <GroupMembers user={user} groups={groups} />
      <TabBar />
    </>
  );
}
