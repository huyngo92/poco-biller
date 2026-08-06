import { getCurrentUser } from "@/lib/auth";
import { listGroupsOfUser } from "@/lib/queries";
import { resolveGroup } from "@/lib/client";
import { getReminders, type Reminder } from "@/lib/logic";
import Reminders from "./Reminders";
import TabBar from "@/components/TabBar";

export const dynamic = "force-dynamic";

export default async function NhacNoPage() {
  const user = await getCurrentUser();
  if (!user) {
    // Middleware should handle this
    return null;
  }

  // `SELECT g.*` trả cột thô invite_code (snake_case), không khớp inviteCode
  // mà Group type/UI đọc — cùng lỗi vừa sửa ở trang Cài đặt.
  const groups = listGroupsOfUser(user.id);

  const groupId = resolveGroup(groups)?.id ?? null;

  const reminders: Reminder[] = groupId ? getReminders(groupId) : [];

  return (
    <>
      <Reminders initialReminders={reminders} groups={groups} user={user} />
      <TabBar />
    </>
  );
}
