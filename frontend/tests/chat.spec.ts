import { expect, test, type Page } from "@playwright/test";

const user = { id: 1, username: "admin", full_name: "Quản trị viên", role: "admin" };

async function setup(page: Page, available = true) {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: user }));
  await page.route("**/api/exams", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/chat/health", (route) => route.fulfill({ json: { available, message: available ? "Đã kết nối" : "Dịch vụ AI tạm chưa sẵn sàng" } }));
  await page.goto("/exams");
  await page.getByRole("button", { name: "Mở trợ lý AI", exact: true }).click();
}

test("open, close, keyboard and responsive layout", async ({ page }, info) => {
  await setup(page);
  const dialog = page.getByRole("dialog", { name: "Trợ lý AI OMR Exam" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Hướng dẫn tạo kỳ thi" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nội dung câu hỏi" })).toBeFocused();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({ path: info.outputPath("chat-welcome.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Mở trợ lý AI", exact: true })).toBeFocused();
});

test("multiple turns, markdown safety, copy, storage and new conversation", async ({ page, context }, info) => {
  const requests: { role: string; content: string }[][] = [];
  const unsafe = "**Tạo kỳ thi**\n\n1. Mở Kỳ thi\n2. Nhấn Tạo kỳ thi\n\n| Mục | Giá trị |\n|---|---|\n| Số câu | 40 |\n\n```python\nprint('OMR')\n```\n\n<script>window.chatInjected = true</script>\n[Liên kết lỗi](javascript:alert(1))\n![tracker](https://invalid.example/tracker.png)";
  await page.route("**/api/chat/completions", async (route) => {
    requests.push(route.request().postDataJSON().messages);
    await route.fulfill({ json: { content: requests.length === 1 ? unsafe : "Câu trả lời tiếp theo", truncated: false } });
  });
  await setup(page);
  await page.getByRole("button", { name: "Hướng dẫn tạo kỳ thi" }).click();
  await expect(page.getByRole("log").locator("strong")).toHaveText("Tạo kỳ thi");
  await expect(page.getByRole("log").locator("table")).toBeVisible();
  await expect(page.getByRole("log").locator("pre")).toContainText("print('OMR')");
  await expect(page.getByRole("log").locator("script, img, a[href^='javascript:']")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { chatInjected?: boolean }).chatInjected)).toBeUndefined();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Sao chép câu trả lời" }).click();
  await expect(page.getByText("Đã sao chép", { exact: true })).toBeVisible();
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(unsafe);
  const input = page.getByRole("textbox", { name: "Nội dung câu hỏi" });
  await input.fill("Tiếp theo");
  await input.press("Shift+Enter");
  await input.press("z");
  await expect(input).toHaveValue("Tiếp theo\nz");
  expect(requests).toHaveLength(1);
  await input.press("Enter");
  await expect(page.getByText("Câu trả lời tiếp theo", { exact: true })).toBeVisible();
  expect(requests[1].map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  await page.screenshot({ path: info.outputPath("chat-conversation.png") });
  await page.getByRole("button", { name: "Đóng chatbot" }).click();
  await page.getByRole("button", { name: "Mở trợ lý AI", exact: true }).click();
  await expect(page.getByText("Câu trả lời tiếp theo", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mở trợ lý AI", exact: true }).click();
  await expect(page.getByText("Câu trả lời tiếp theo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hội thoại mới", exact: true }).click();
  await page.getByRole("button", { name: "Hội thoại mới", exact: true }).last().click();
  await expect(page.getByRole("log")).not.toContainText("Câu trả lời tiếp theo");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("omr:chat:1")!))).toEqual([]);
});

test("educational markdown renders math while keeping code literal and wide content contained", async ({ page }, info) => {
  const longFormula = Array.from({ length: 30 }, (_, i) => `x_{${i + 1}}`).join(" + ");
  const answer = [
    "## Định luật II Newton",
    "Gia tốc của một vật **cùng hướng với hợp lực** tác dụng lên vật. Công thức: $F = ma$.",
    "### Công thức tổng quát",
    String.raw`$$
\vec{F} = m\vec{a}, \qquad a = \frac{F}{m}
$$`,
    "> Với cùng khối lượng, lực tác dụng càng lớn thì gia tốc càng lớn.",
    "### Ví dụ minh họa",
    "- Khối lượng: 2 kg.\n- Gia tốc: 3 m/s².\n- Hợp lực: **6 N**.",
    "| Đại lượng | Ký hiệu | Đơn vị |\n|---|---|---|\n| Hợp lực | F | N |\n| Khối lượng | m | kg |\n| Gia tốc | a | m/s² |",
    "```text\n$F = ma$\n```",
    `$$\n${longFormula}\n$$`,
  ].join("\n\n");
  await page.route("**/api/chat/completions", (route) => route.fulfill({ json: { content: answer, truncated: false } }));
  await setup(page);
  await page.getByRole("textbox", { name: "Nội dung câu hỏi" }).fill("Định luật II Newton là gì?");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  const markdown = page.locator(".chat-markdown");
  await expect(markdown.getByRole("heading", { name: "Định luật II Newton" })).toBeVisible();
  await expect(markdown.locator("p .katex")).toHaveCount(1);
  await expect(markdown.locator(".katex-display")).toHaveCount(2);
  await expect(markdown.locator(".katex-display").first().locator("annotation")).toContainText(String.raw`\frac{F}{m}`);
  await expect(markdown.locator("pre code")).toHaveText("$F = ma$\n");
  await expect(markdown.getByRole("table")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const layout = await markdown.evaluate((element) => {
    const formula = element.querySelectorAll<HTMLElement>(".katex-display")[1];
    return {
      contained: element.scrollWidth <= element.clientWidth + 1,
      formulaScrollable: formula.scrollWidth > formula.clientWidth,
    };
  });
  expect(layout).toEqual({ contained: true, formulaScrollable: true });
  await page.getByRole("log").evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: info.outputPath("chat-markdown-math.png") });
});

test("invalid and untrusted math does not break the answer or create unsafe links", async ({ page }) => {
  const answer = String.raw`Công thức hợp lệ: $F = ma$.

Công thức lỗi: $\frac{1}{$.

$\href{javascript:alert(1)}{unsafe}$

Nội dung phía sau vẫn đọc được.`;
  await page.route("**/api/chat/completions", (route) => route.fulfill({ json: { content: answer, truncated: false } }));
  await setup(page);
  await page.getByRole("button", { name: "Cách nhập đáp án" }).click();
  const markdown = page.locator(".chat-markdown");
  await expect(markdown).toContainText("Nội dung phía sau vẫn đọc được.");
  await expect(markdown.locator(".katex-error")).toHaveCount(1);
  await expect(markdown.locator("script, iframe, a[href^='javascript:']")).toHaveCount(0);
  await expect(markdown.locator(".katex")).toHaveCount(2);
});

test("offline service, pending request, retry, edit and upstream auth failure", async ({ page }, info) => {
  let calls = 0;
  await page.route("**/api/chat/completions", async (route) => {
    calls++;
    if (calls === 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({ status: 502, json: { detail: "Dịch vụ AI chưa được cấu hình quyền truy cập." } });
    } else await route.fulfill({ json: { content: "Đã kết nối lại", truncated: true } });
  });
  await setup(page, false);
  await expect(page.getByText("Chưa kết nối dịch vụ AI", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Nội dung câu hỏi" });
  await input.fill("Xin chào");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.getByText("Đang trả lời…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi câu hỏi" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("quyền truy cập");
  expect(page.url()).toContain("/exams");
  await page.screenshot({ path: info.outputPath("chat-offline.png") });
  await page.getByRole("button", { name: "Sửa câu hỏi", exact: true }).click();
  await expect(input).toHaveValue("Xin chào");
  await expect(input).toBeEnabled();
  await input.press("Enter");
  await expect(page.getByText("Đã kết nối lại", { exact: true })).toBeVisible();
  await expect(page.getByText(/Câu trả lời đã đạt giới hạn/)).toBeVisible();
  expect(calls).toBe(2);
});

test("retry restores pending question after reload; session expiration clears history", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/chat/completions", (route) => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 504, json: { detail: "Phản hồi quá lâu" } })
      : route.fulfill({ json: { content: "Trả lời sau thử lại", truncated: false } });
  });
  await setup(page);
  await page.getByRole("button", { name: "Cách nhập đáp án" }).click();
  await expect(page.getByRole("alert")).toContainText("Phản hồi quá lâu");
  await page.reload();
  await page.getByRole("button", { name: "Mở trợ lý AI", exact: true }).click();
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByText("Trả lời sau thử lại", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("omr:unauthorized")));
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("omr:chat:")))).toEqual([]);
  await expect(page.getByRole("button", { name: "Mở trợ lý AI", exact: true })).toHaveCount(0);
});

test("history is scoped to current account and truncated by complete pairs", async ({ page }) => {
  const messages = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? "assistant" : "user", content: `Tin nhắn ${i}` }));
  await page.addInitScript(({ messages }) => {
    sessionStorage.setItem("omr:chat:1", JSON.stringify(messages));
    sessionStorage.setItem("omr:chat:2", JSON.stringify([{ id: "other", role: "user", content: "Nội dung tài khoản khác" }]));
  }, { messages });
  let sent: { role: string; content: string }[] = [];
  await page.route("**/api/chat/completions", (route) => {
    sent = route.request().postDataJSON().messages;
    return route.fulfill({ json: { content: "Đã nhận lịch sử", truncated: false } });
  });
  await setup(page);
  await expect(page.getByRole("log")).not.toContainText("Nội dung tài khoản khác");
  await page.getByRole("textbox", { name: "Nội dung câu hỏi" }).fill("Hỏi tiếp");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.getByText("Đã nhận lịch sử", { exact: true })).toBeVisible();
  expect(sent).toHaveLength(19);
  expect(sent[0]).toEqual({ role: "user", content: "Tin nhắn 22" });
  expect(sent.at(-1)).toEqual({ role: "user", content: "Hỏi tiếp" });
});

test("logout clears chat storage and another login starts fresh", async ({ page }, info) => {
  await page.route("**/api/chat/completions", (route) => route.fulfill({ json: { content: "Nội dung riêng tài khoản cũ", truncated: false } }));
  await page.route("**/api/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/auth/login", (route) => route.fulfill({ json: { ...user, id: 2, username: "teacher", role: "teacher" } }));
  await setup(page);
  await page.getByRole("button", { name: "Cách nhập đáp án" }).click();
  await expect(page.getByText("Nội dung riêng tài khoản cũ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đóng chatbot" }).click();
  if (info.project.name === "mobile") await page.locator("header").first().locator("button").first().click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("omr:chat:")))).toEqual([]);
  await page.getByLabel("Tên đăng nhập").fill("teacher");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("secret");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("button", { name: "Mở trợ lý AI", exact: true }).click();
  await expect(page.getByRole("log")).not.toContainText("Nội dung riêng tài khoản cũ");
  await expect(page.getByRole("button", { name: "Hướng dẫn tạo kỳ thi" })).toBeVisible();
});

test("chat works without secure-context UUID or browser storage", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
    Storage.prototype.setItem = () => { throw new Error("Storage disabled"); };
  });
  await page.route("**/api/chat/completions", (route) => route.fulfill({ json: { content: "Chat hoạt động trong LAN", truncated: false } }));
  await setup(page);
  await page.getByRole("button", { name: "Cách nhập đáp án" }).click();
  await expect(page.getByText("Chat hoạt động trong LAN", { exact: true })).toBeVisible();
});
