import { requireUser } from "@/lib/auth";
import {
  deleteBankAccount,
  getBankAccount,
  upsertBankAccount,
} from "@/lib/queries";
import { fail, ok, str } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ account: getBankAccount(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const bankId = str(body.bankId, "ngân hàng", 20);
    const accountNumber = str(body.accountNumber, "số tài khoản", 34);
    const accountName = str(body.accountName, "tên chủ tài khoản", 80);

    upsertBankAccount(user.id, { bankId, accountNumber, accountName });
    return ok({ account: getBankAccount(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    deleteBankAccount(user.id);
    return ok({ account: null });
  } catch (e) {
    return fail(e);
  }
}
