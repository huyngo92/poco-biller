import { getCurrentUser } from "@/lib/auth";
import { listGroupsOfUser } from "@/lib/queries";
import Settings from "./Settings";
import TabBar from "@/components/TabBar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    // Middleware should handle this
    return null;
  }

  // `SELECT g.*` trước đây trả cột thô invite_code (snake_case), không khớp
  // field inviteCode mà Settings.tsx đọc — mã mời hiện trống. listGroupsOfUser
  // đã alias đúng tên cột, dùng lại thay vì tự viết SQL ở page.tsx.
  const groups = listGroupsOfUser(user.id);

  return (
    <>
      <Settings user={user} groups={groups} />
      <TabBar />
    </>
  );
}