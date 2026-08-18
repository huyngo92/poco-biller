import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Security from "./Security";
import TabBar from "@/components/TabBar";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");

  return (
    <>
      <Security />
      <TabBar />
    </>
  );
}
