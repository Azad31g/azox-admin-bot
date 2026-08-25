// AZOX Admin Bot — TypeScript (Secured & Validated)
// grammy + @supabase/supabase-js

import { Bot, InlineKeyboard, session } from "grammy";
import { createClient } from "@supabase/supabase-js";

// ─── ENV ────────────────────────────────────────────
const BOT_TOKEN    = process.env.ADMIN_BOT_TOKEN!;
const ADMIN_ID     = Number(process.env.ADMIN_TELEGRAM_ID!);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── TYPES ──────────────────────────────────────────
type Platform = "telegram" | "instagram" | "tiktok" | "x" | "youtube" | "discord";

interface SessionData {
  step?: string;
  platform?: Platform;
  title?: string;
  url?: string;
  points?: number;
  editTaskId?: string;
  editField?: string;
}

// ─── BOT ────────────────────────────────────────────
const bot = new Bot<{ session: SessionData }>(BOT_TOKEN);
bot.use(session({ initial: (): SessionData => ({}) }));

// ─── ADMIN GUARD ────────────────────────────────────
// Applied to EVERY handler — no exceptions
function isAdmin(ctx: any): boolean {
  return ctx.from?.id === ADMIN_ID;
}

async function requireAdmin(ctx: any): Promise<boolean> {
  if (!isAdmin(ctx)) {
    await ctx.reply?.("⛔ Access denied.").catch(() => {});
    await ctx.answerCallbackQuery?.("⛔ Access denied.").catch(() => {});
    return false;
  }
  return true;
}

// ─── VALIDATION ─────────────────────────────────────
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidPoints(str: string): number | null {
  const n = parseInt(str.trim(), 10);
  if (isNaN(n) || n < 0 || n > 100000) return null;
  return n;
}

// ─── PLATFORMS ──────────────────────────────────────
const PLATFORMS: Platform[] = ["telegram", "instagram", "tiktok", "x", "youtube", "discord"];
const PLATFORM_EMOJI: Record<Platform, string> = {
  telegram:  "✈️",
  instagram: "📷",
  tiktok:    "🎵",
  x:         "𝕏",
  youtube:   "▶️",
  discord:   "💬",
};

// ─── KEYBOARDS ──────────────────────────────────────
function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text("➕ Add Task",    "menu_add")
    .text("✏️ Edit Task",   "menu_edit").row()
    .text("🚫 Disable Task","menu_disable")
    .text("🗑 Delete Task", "menu_delete").row()
    .text("📋 View Tasks",  "menu_view");
}

function platformKeyboard(prefix: string) {
  const kb = new InlineKeyboard();
  PLATFORMS.forEach((p, i) => {
    kb.text(`${PLATFORM_EMOJI[p]} ${p}`, `${prefix}_${p}`);
    if (i % 2 === 1) kb.row();
  });
  kb.row().text("❌ Cancel", "cancel");
  return kb;
}

// ─── /start & /edit_task ────────────────────────────
bot.command("start", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  await ctx.reply("👋 AZOX Admin Bot\n\nUse /edit_task to manage tasks.");
});

bot.command("edit_task", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.reply("🛠 Task Management", { reply_markup: mainMenuKeyboard() });
});

// ─── CANCEL ─────────────────────────────────────────
bot.callbackQuery("cancel", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.editMessageText("✅ Cancelled.");
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_back", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = {};
  await ctx.editMessageText("🛠 Task Management", { reply_markup: mainMenuKeyboard() });
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// ➕ ADD TASK FLOW
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_add", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "add_platform" };
  await ctx.editMessageText("➕ Add Task\n\nChoose platform:", {
    reply_markup: platformKeyboard("add_plat"),
  });
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`add_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    ctx.session.platform = p;
    ctx.session.step = "add_title";
    await ctx.editMessageText(
      `➕ Add — ${PLATFORM_EMOJI[p]} ${p}\n\nSend the account name:\n(e.g. AZOX Foundation)`
    );
    await ctx.answerCallbackQuery();
  });
});

// ─── TEXT HANDLER (all steps) ───────────────────────
bot.on("message:text", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const s = ctx.session;
  const text = ctx.message.text.trim();

  // ADD: title
  if (s.step === "add_title") {
    if (text.length < 2 || text.length > 80) {
      return ctx.reply("❌ Name must be 2–80 characters. Try again:");
    }
    s.title = text;
    s.step  = "add_url";
    return ctx.reply(`✅ Name: ${text}\n\nSend the account URL (must start with https://):`);
  }

  // ADD: url
  if (s.step === "add_url") {
    if (!isValidUrl(text)) {
      return ctx.reply("❌ Invalid URL. Must start with https:// or http://\nTry again:");
    }
    s.url  = text;
    s.step = "add_points";
    return ctx.reply(`✅ URL saved.\n\nHow many points? (1–100000):`);
  }

  // ADD: points
  if (s.step === "add_points") {
    const pts = isValidPoints(text);
    if (pts === null) {
      return ctx.reply("❌ Invalid. Enter a number between 1 and 100000:");
    }
    s.points = pts;
    s.step = "add_tasks";
     return ctx.reply("How many Tasks to reward? (0 = no task reward, 1 = +1 Task, etc.):");
    const kb = new InlineKeyboard()
      .text("✅ Confirm & Add", "add_confirm")
      .text("❌ Cancel", "cancel");
    return ctx.reply(
      `📋 New Task:\n\n` +
      `Platform: ${PLATFORM_EMOJI[s.platform!]} ${s.platform}\n` +
      `Title: ${s.title}\n` +
      `URL: ${s.url}\n` +
      `Points: +${s.points}`,
      { reply_markup: kb }
    );
  }

  // EDIT: new value
  if (s.step === "edit_value" && s.editTaskId && s.editField) {
    let value: string | number = text;

    if (s.editField === "points") {
      const pts = isValidPoints(text);
      if (pts === null) return ctx.reply("❌ Invalid. Enter a number between 1 and 100000:");
      value = pts;
    }
    if (s.editField === "url" && !isValidUrl(text)) {
      return ctx.reply("❌ Invalid URL. Must start with https://\nTry again:");
    }
    if (s.editField === "title" && (text.length < 2 || text.length > 80)) {
      return ctx.reply("❌ Name must be 2–80 characters. Try again:");
    }

    const { error } = await supabase
      .from("tasks")
      .update({ [s.editField]: value })
      .eq("id", s.editTaskId);

    ctx.session = {};
    if (error) return ctx.reply(`❌ Error: ${error.message}`);
    return ctx.reply("✅ Task updated successfully!");
  }
});

// Confirm add
bot.callbackQuery("add_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;

  if (!s.platform || !s.title || !s.url || s.points === undefined) {
    await ctx.editMessageText("❌ Session expired. Use /edit_task again.");
    return ctx.answerCallbackQuery();
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("tasks")
    .select("id")
    .eq("platform", s.platform)
    .ilike("title", s.title)
    .limit(1);

  if (existing && existing.length > 0) {
    ctx.session = {};
    await ctx.editMessageText(`⚠️ A task named "${s.title}" already exists in ${s.platform}.\n\nNo duplicate added.`);
    return ctx.answerCallbackQuery();
  }

  // Get next sort_order
  const { data: last } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("platform", s.platform)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (last?.[0]?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("tasks").insert({
    platform:   s.platform,
    title:      s.title,
    url:        s.url,
    points:     s.points,
    status:     "active",
    sort_order: nextOrder,
  });

  ctx.session = {};
  if (error) {
    await ctx.editMessageText(`❌ Error saving task: ${error.message}`);
  } else {
    await ctx.editMessageText(
      `✅ Task added!\n\n${PLATFORM_EMOJI[s.platform!]} ${s.title}\n+${s.points} pts`
    );
  }
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// ✏️ EDIT TASK FLOW
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_edit", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "edit_platform" };
  await ctx.editMessageText("✏️ Edit Task\n\nChoose platform:", {
    reply_markup: platformKeyboard("edit_plat"),
  });
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`edit_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, points, status")
      .eq("platform", p)
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      await ctx.editMessageText(`No tasks for ${PLATFORM_EMOJI[p]} ${p}.`);
      return ctx.answerCallbackQuery();
    }

    ctx.session = { step: "edit_task", platform: p };
    const kb = new InlineKeyboard();
    tasks.forEach((t: any) => {
      const icon = t.status === "active" ? "🟢" : "🔴";
      kb.text(`${icon} ${t.title} (+${t.points})`, `editsel_${t.id}`).row();
    });
    kb.text("❌ Cancel", "cancel");

    await ctx.editMessageText(
      `✏️ ${PLATFORM_EMOJI[p]} ${p} — Choose task:`,
      { reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });
});

bot.callbackQuery(/^editsel_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("*").eq("id", taskId).single();

  if (!task) {
    await ctx.editMessageText("❌ Task not found.");
    return ctx.answerCallbackQuery();
  }

  ctx.session = { step: "edit_field", editTaskId: taskId };
  const kb = new InlineKeyboard()
    .text("📝 Title",  `editfield_${taskId}_title`).row()
    .text("🔗 URL",    `editfield_${taskId}_url`).row()
    .text("🎯 Points", `editfield_${taskId}_points`).row()
    .text(
      task.status === "active" ? "🔴 Disable" : "🟢 Enable",
      `edittoggle_${taskId}`
    ).row()
    .text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `✏️ Editing: ${task.title}\n` +
    `Points: +${task.points}\n` +
    `Status: ${task.status === "active" ? "🟢 Active" : "🔴 Disabled"}`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^editfield_(.+)_(title|url|points)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const [, taskId, field] = ctx.match;
  ctx.session = { step: "edit_value", editTaskId: taskId, editField: field };
  const labels: Record<string, string> = {
    title:  "📝 Send the new title (2–80 chars):",
    url:    "🔗 Send the new URL (https://...):",
    points: "🎯 Send the new points (1–100000):",
  };
  await ctx.editMessageText(labels[field]!);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^edittoggle_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("status, title").eq("id", taskId).single();

  if (!task) {
    await ctx.editMessageText("❌ Task not found.");
    return ctx.answerCallbackQuery();
  }

  const newStatus = task.status === "active" ? "disabled" : "active";
  await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
  ctx.session = {};
  await ctx.editMessageText(
    `✅ "${task.title}" is now ${newStatus === "active" ? "🟢 Active" : "🔴 Disabled"}`
  );
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 🚫 DISABLE TASK (safe — keeps data)
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_disable", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "disable_platform" };
  await ctx.editMessageText("🚫 Disable Task\n\nChoose platform:", {
    reply_markup: platformKeyboard("dis_plat"),
  });
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`dis_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, points, status")
      .eq("platform", p)
      .eq("status", "active")
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      await ctx.editMessageText(`No active tasks in ${PLATFORM_EMOJI[p]} ${p}.`);
      return ctx.answerCallbackQuery();
    }

    const kb = new InlineKeyboard();
    tasks.forEach((t: any) => {
      kb.text(`${t.title} (+${t.points})`, `disconfirm_${t.id}`).row();
    });
    kb.text("❌ Cancel", "cancel");

    await ctx.editMessageText(
      `🚫 Disable — ${PLATFORM_EMOJI[p]} ${p}\nChoose task to disable:`,
      { reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });
});

bot.callbackQuery(/^disconfirm_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("title").eq("id", taskId).single();

  await supabase.from("tasks").update({ status: "disabled" }).eq("id", taskId);
  ctx.session = {};
  await ctx.editMessageText(`🚫 "${task?.title}" disabled.\nIt is now hidden from the Mini App.\nUse ✏️ Edit Task → Enable to restore it.`);
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 🗑 DELETE TASK (permanent — with confirmation)
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_delete", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "delete_platform" };
  await ctx.editMessageText(
    "🗑 Delete Task (permanent)\n\n⚠️ Consider using 🚫 Disable instead.\n\nChoose platform:",
    { reply_markup: platformKeyboard("del_plat") }
  );
  await ctx.answerCallbackQuery();
});

PLATFORMS.forEach((p) => {
  bot.callbackQuery(`del_plat_${p}`, async (ctx) => {
    if (!await requireAdmin(ctx)) return;
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, points, status")
      .eq("platform", p)
      .order("sort_order");

    if (!tasks || tasks.length === 0) {
      await ctx.editMessageText(`No tasks in ${PLATFORM_EMOJI[p]} ${p}.`);
      return ctx.answerCallbackQuery();
    }

    const kb = new InlineKeyboard();
    tasks.forEach((t: any) => {
      const icon = t.status === "active" ? "🟢" : "🔴";
      kb.text(`${icon} ${t.title} (+${t.points})`, `delsel_${t.id}`).row();
    });
    kb.text("❌ Cancel", "cancel");

    await ctx.editMessageText(
      `🗑 ${PLATFORM_EMOJI[p]} ${p} — Choose task to DELETE:`,
      { reply_markup: kb }
    );
    await ctx.answerCallbackQuery();
  });
});

bot.callbackQuery(/^delsel_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("title, points, platform").eq("id", taskId).single();

  if (!task) {
    await ctx.editMessageText("❌ Task not found.");
    return ctx.answerCallbackQuery();
  }

  const kb = new InlineKeyboard()
    .text("🗑 YES — Delete permanently", `delconfirm_${taskId}`).row()
    .text("🚫 Disable instead (safer)", `disconfirm_${taskId}`).row()
    .text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `⚠️ DELETE "${task.title}" from ${task.platform}?\n` +
    `Points: +${task.points}\n\n` +
    `This CANNOT be undone.\n` +
    `Consider Disable if you might need it later.`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^delconfirm_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const taskId = ctx.match[1];
  const { data: task } = await supabase
    .from("tasks").select("title").eq("id", taskId).single();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  ctx.session = {};

  if (error) {
    await ctx.editMessageText(`❌ Error: ${error.message}`);
  } else {
    await ctx.editMessageText(`✅ "${task?.title}" permanently deleted.`);
  }
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 📋 VIEW TASKS
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_view", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("platform")
    .order("sort_order");

  if (!tasks || tasks.length === 0) {
    await ctx.editMessageText("📋 No tasks found.\n\nUse ➕ Add Task to get started.", {
      reply_markup: new InlineKeyboard().text("🔙 Back", "menu_back"),
    });
    return ctx.answerCallbackQuery();
  }

  let msg = "📋 All Tasks:\n\n";
  let cur = "";
  let total = 0;
  tasks.forEach((t: any) => {
    if (t.platform !== cur) {
      cur = t.platform;
      msg += `${PLATFORM_EMOJI[t.platform as Platform]} ${t.platform.toUpperCase()}\n`;
    }
    const icon = t.status === "active" ? "🟢" : "🔴";
    msg += `  ${icon} ${t.title} (+${t.points})\n`;
    total++;
  });
  msg += `\nTotal: ${total} tasks`;

  await ctx.editMessageText(msg, {
    reply_markup: new InlineKeyboard().text("🔙 Back", "menu_back"),
  });
  await ctx.answerCallbackQuery();
});

// ─── START ──────────────────────────────────────────
bot.start();
console.log(`✅ AZOX Admin Bot running (Admin: ${ADMIN_ID})`);
