import { HttpError } from "./auth";

/**
 * Backup file lên GitHub repo (branch riêng) bằng GitHub Contents API.
 * Không cần Google Drive, hoạt động với Gmail cá nhân.
 */

const BACKUP_BRANCH = "backup-data";

function getConfig() {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO; // e.g. "huyngo92/poco-biller"
  if (!token || !repo) return null;
  return { token, repo };
}

export function githubBackupConfigured(): boolean {
  return getConfig() !== null;
}

async function ghApi(
  path: string,
  token: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    method: opts.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    // BẮT BUỘC no-store. Next patch fetch toàn cục và cache GET theo mặc định,
    // nên lời gọi lấy sha của file hiện tại có thể trả giá trị cũ; gửi sha cũ
    // lên thì GitHub từ chối với 409 "does not match <sha>". Đã gặp đúng lỗi này
    // khi backup lần thứ hai trong cùng một ngày (cùng tên file).
    cache: "no-store",
  });
}

/** Ensure backup branch exists (based off default branch). */
async function ensureBranch(token: string, repo: string): Promise<void> {
  // Check if branch exists
  const check = await ghApi(`/repos/${repo}/git/ref/heads/${BACKUP_BRANCH}`, token);
  if (check.ok) return;

  // Hỏi GitHub tên nhánh mặc định thật thay vì đoán main/master: repo có thể
  // đặt tên khác, và lời gọi này cũng xác nhận token đọc được repo.
  const repoInfo = await ghApi(`/repos/${repo}`, token);
  if (!repoInfo.ok) {
    const detail = (await repoInfo.text().catch(() => "")).slice(0, 200);
    if (repoInfo.status === 401)
      throw new HttpError(
        502,
        `GitHub từ chối token (401). GITHUB_BACKUP_TOKEN có thể đã hết hạn hoặc sai. ${detail}`
      );
    throw new HttpError(
      502,
      `Không truy cập được repo "${repo}" (${repoInfo.status}). Repo private trả về ` +
        `404 như thể không tồn tại khi token thiếu quyền. Kiểm tra GITHUB_BACKUP_REPO ` +
        `đúng dạng "owner/repo", token classic tick quyền "repo", token fine-grained ` +
        `đã chọn repo này ở Repository access. ${detail}`
    );
  }

  const info = (await repoInfo.json()) as { default_branch?: string };
  const base = info.default_branch || "main";

  const baseRef = await ghApi(`/repos/${repo}/git/ref/heads/${base}`, token);
  if (!baseRef.ok) {
    const detail = (await baseRef.text().catch(() => "")).slice(0, 200);
    // Đọc được metadata repo mà không đọc được git ref là dấu hiệu kinh điển
    // của token fine-grained thiếu quyền Contents (Metadata thì đủ cho
    // /repos/{repo}, nhưng git/refs đòi Contents).
    throw new HttpError(
      502,
      `Đọc được repo "${repo}" nhưng không lấy được nhánh "${base}" (${baseRef.status}). ` +
        `Nếu nhánh này có commit trên GitHub thì gần như chắc chắn token thiếu quyền ` +
        `Contents: token fine-grained cần Repository permissions → Contents: Read and write ` +
        `(chỉ Metadata là không đủ); token classic cần tick quyền "repo" đầy đủ. ${detail}`
    );
  }

  const data = (await baseRef.json()) as { object: { sha: string } };
  const created = await ghApi(`/repos/${repo}/git/refs`, token, {
    method: "POST",
    body: { ref: `refs/heads/${BACKUP_BRANCH}`, sha: data.object.sha },
  });
  if (!created.ok && created.status !== 422) {
    const detail = (await created.text().catch(() => "")).slice(0, 200);
    throw new HttpError(
      502,
      `Không tạo được nhánh "${BACKUP_BRANCH}" (${created.status}). ` +
        `Token cần quyền ghi Contents: Read and write. ${detail}`
    );
  }
}

/** Upload or update a file on the backup branch. */
export async function uploadToGitHub(args: {
  name: string;
  content: Buffer;
}): Promise<{ path: string; sha: string }> {
  const cfg = getConfig();
  if (!cfg) throw new HttpError(503, "Chưa cấu hình GitHub backup. Cần GITHUB_BACKUP_TOKEN và GITHUB_BACKUP_REPO.");

  await ensureBranch(cfg.token, cfg.repo);

  const filePath = `backups/${args.name}`;
  const b64 = args.content.toString("base64");

  // Ghi đè file cùng tên (backup nhiều lần trong một ngày) đòi sha của bản hiện
  // tại. Nếu sha đọc được đã lỗi thời — hai lần backup chạy chồng nhau, hoặc có
  // ai commit tay lên nhánh backup — GitHub trả 409. Đọc lại sha và thử một lần
  // nữa là đủ; lỗi này bản chất là tranh chấp nhất thời, không phải sai cấu hình.
  const attempts = 2;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const existing = await ghApi(
      `/repos/${cfg.repo}/contents/${filePath}?ref=${BACKUP_BRANCH}`,
      cfg.token
    );
    let sha: string | undefined;
    if (existing.ok) {
      const data = (await existing.json()) as { sha: string };
      sha = data.sha;
    }

    const res = await ghApi(`/repos/${cfg.repo}/contents/${filePath}`, cfg.token, {
      method: "PUT",
      body: {
        message: `backup: ${args.name}`,
        content: b64,
        branch: BACKUP_BRANCH,
        ...(sha ? { sha } : {}),
      },
    });

    if (res.ok) {
      const result = (await res.json()) as { content: { path: string; sha: string } };
      return { path: result.content.path, sha: result.content.sha };
    }

    const detail = await res.text().catch(() => "");

    if (res.status === 409 && attempt < attempts) {
      console.warn(
        `[poco-biller] GitHub trả 409 khi ghi ${filePath} (sha lỗi thời) — đọc lại sha và thử lại.`
      );
      continue;
    }

    if (res.status === 409)
      throw new HttpError(
        502,
        `Ghi ${filePath} lên GitHub thất bại vì xung đột sha sau ${attempts} lần thử (409). ` +
          `File này vừa bị thay đổi bởi tiến trình khác trên nhánh "${BACKUP_BRANCH}". ` +
          `Kiểm tra xem có instance app thứ hai cùng backup vào một repo hay không. ${detail.slice(0, 200)}`
      );

    throw new HttpError(502, `Upload lên GitHub thất bại (${res.status}). ${detail.slice(0, 300)}`);
  }

  // Không tới được: vòng lặp luôn return hoặc throw.
  throw new HttpError(502, "Upload lên GitHub thất bại.");
}

/** Find latest backup file by prefix on the backup branch. */
export async function findLatestGitHubBackup(
  prefix: string
): Promise<{ name: string; sha: string; download_url: string } | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  const res = await ghApi(
    `/repos/${cfg.repo}/contents/backups?ref=${BACKUP_BRANCH}`,
    cfg.token
  );
  if (!res.ok) return null;

  const files = (await res.json()) as { name: string; sha: string; download_url: string }[];
  const matches = files
    .filter((f) => f.name.startsWith(prefix))
    .sort((a, b) => b.name.localeCompare(a.name));

  return matches[0] ?? null;
}

/** Download file content from GitHub backup branch. */
export async function downloadFromGitHub(filePath: string): Promise<Buffer> {
  const cfg = getConfig();
  if (!cfg) throw new HttpError(503, "Chưa cấu hình GitHub backup.");

  const res = await ghApi(
    `/repos/${cfg.repo}/contents/${filePath}?ref=${BACKUP_BRANCH}`,
    cfg.token
  );
  if (!res.ok) throw new HttpError(502, `Download từ GitHub thất bại (${res.status}).`);

  const data = (await res.json()) as { content: string; encoding: string; sha: string };

  // File trên 1MB: Contents API không nhúng nội dung (encoding = "none"),
  // phải lấy qua Git Blob API dạng raw. File .db rất nhanh vượt mốc này.
  if (data.encoding !== "base64" || !data.content) {
    const blob = await fetch(`https://api.github.com/repos/${cfg.repo}/git/blobs/${data.sha}`, {
      headers: {
        authorization: `Bearer ${cfg.token}`,
        accept: "application/vnd.github.raw",
        "x-github-api-version": "2022-11-28",
      },
      // Không để Next cache: đây là đường tải bản backup về khôi phục, lấy phải
      // file cũ thì mất dữ liệu mà không có dấu hiệu gì.
      cache: "no-store",
    });
    if (!blob.ok)
      throw new HttpError(502, `Download blob từ GitHub thất bại (${blob.status}).`);
    return Buffer.from(await blob.arrayBuffer());
  }

  return Buffer.from(data.content, "base64");
}
