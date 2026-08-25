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
  taskReward?: number;
  msgBody?: string;     // ← for announcements
  editTaskId?: string;
  editField?: string;
}

// ─── BOT ────────────────────────────────────────────
const bot = new Bot<{ session: SessionData }>(BOT_TOKEN);
bot.use(session({ initial: (): SessionData => ({}) }));

// ─── ADMIN GUARD ────────────────────────────────────
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

function isValidTaskReward(str: string): number | null {
  const n = parseInt(str.trim(), 10);
  if (isNaN(n) || n < 0 || n > 100) return null;
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
    s.step   = "add_tasks";
    return ctx.reply(
      `✅ Points: +${pts}\n\nHow many Tasks to reward?\n(0 = no task reward, 1 = +1 Task, 2 = +2 Tasks...)\n\nEnter a number between 0 and 100:`
    );
  }

  // ADD: task reward ← NEW STEP
  if (s.step === "add_tasks") {
    const reward = isValidTaskReward(text);
    if (reward === null) {
      return ctx.reply("❌ Invalid. Enter a number between 0 and 100:");
    }
    s.taskReward = reward;
    s.step       = "add_confirm";
    const kb = new InlineKeyboard()
      .text("✅ Confirm & Add", "add_confirm")
      .text("❌ Cancel", "cancel");
    const taskLine = reward > 0 ? `\nTask Reward: +${reward} Task(s)` : "\nTask Reward: None";
    return ctx.reply(
      `📋 New Task:\n\n` +
      `Platform: ${PLATFORM_EMOJI[s.platform!]} ${s.platform}\n` +
      `Title: ${s.title}\n` +
      `URL: ${s.url}\n` +
      `Points: +${s.points}` +
      taskLine,
      { reply_markup: kb }
    );
  }


  // MESSAGE: title
  if (s.step === "msg_title") {
    if (text.length < 2 || text.length > 100) {
      return ctx.reply("❌ Title must be 2–100 characters:");
    }
    s.title = text;
    s.step  = "msg_body";
    return ctx.reply("✅ Title saved.\n\nSend the announcement message:");
  }

  // MESSAGE: body
  if (s.step === "msg_body") {
    s.msgBody = text;
    s.step    = "msg_confirm";
    const kb = new InlineKeyboard()
      .text("✅ Send to all users", "msg_confirm")
      .text("❌ Cancel", "cancel");
    return ctx.reply(
      `📢 Preview:\n\n📌 ${s.title}\n\n${text}`,
      { reply_markup: kb }
    );
  }

  // EDIT MESSAGE: new value
  if (s.step === "editmsg_value" && s.editTaskId && s.editField) {
    const { error } = await supabase
      .from("announcements")
      .update({ [s.editField]: text })
      .eq("id", s.editTaskId);
    ctx.session = {};
    if (error) return ctx.reply("❌ Error: " + error.message);
    return ctx.reply("✅ Announcement updated!");
  }

  // EDIT: new value
  if (s.step === "edit_value" && s.editTaskId && s.editField) {
    let value: string | number = text;

    if (s.editField === "points") {
      const pts = isValidPoints(text);
      if (pts === null) return ctx.reply("❌ Invalid. Enter a number between 1 and 100000:");
      value = pts;
    }
    if (s.editField === "task_reward") {
      const reward = isValidTaskReward(text);
      if (reward === null) return ctx.reply("❌ Invalid. Enter a number between 0 and 100:");
      value = reward;
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
  const taskReward = s.taskReward ?? 0;

  const { error } = await supabase.from("tasks").insert({
    platform:    s.platform,
    title:       s.title,
    url:         s.url,
    points:      s.points,
    task_reward: taskReward,
    status:      "active",
    sort_order:  nextOrder,
  });

  ctx.session = {};
  if (error) {
    await ctx.editMessageText(`❌ Error saving task: ${error.message}`);
  } else {
    const taskLine = taskReward > 0 ? ` & +${taskReward} Task(s)` : "";
    await ctx.editMessageText(
      `✅ Task added!\n\n${PLATFORM_EMOJI[s.platform!]} ${s.title}\n+${s.points} pts${taskLine}`
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
      .select("id, title, points, task_reward, status")
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
      const taskInfo = t.task_reward > 0 ? ` +${t.task_reward}T` : "";
      kb.text(`${icon} ${t.title} (+${t.points}${taskInfo})`, `editsel_${t.id}`).row();
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
    .text("📝 Title",       `editfield_${taskId}_title`).row()
    .text("🔗 URL",         `editfield_${taskId}_url`).row()
    .text("🎯 Points",      `editfield_${taskId}_points`).row()
    .text("⚡ Task Reward", `editfield_${taskId}_task_reward`).row()
    .text(
      task.status === "active" ? "🔴 Disable" : "🟢 Enable",
      `edittoggle_${taskId}`
    ).row()
    .text("❌ Cancel", "cancel");

  const taskLine = task.task_reward > 0 ? `\nTask Reward: +${task.task_reward} Task(s)` : "\nTask Reward: None";
  await ctx.editMessageText(
    `✏️ Editing: ${task.title}\n` +
    `Points: +${task.points}` +
    taskLine + `\n` +
    `Status: ${task.status === "active" ? "🟢 Active" : "🔴 Disabled"}`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^editfield_(.+)_(title|url|points|task_reward)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const [, taskId, field] = ctx.match;
  ctx.session = { step: "edit_value", editTaskId: taskId, editField: field };
  const labels: Record<string, string> = {
    title:       "📝 Send the new title (2–80 chars):",
    url:         "🔗 Send the new URL (https://...):",
    points:      "🎯 Send the new points (1–100000):",
    task_reward: "⚡ Send the new task reward (0–100):\n(0 = no task reward)",
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
// 🚫 DISABLE TASK
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
      .select("id, title, points")
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
      `🚫 Disable — ${PLATFORM_EMOJI[p]} ${p}\nChoose task:`,
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
  await ctx.editMessageText(
    `🚫 "${task?.title}" disabled.\nUse ✏️ Edit → Enable to restore.`
  );
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 🗑 DELETE TASK
// ═══════════════════════════════════════════════════

bot.callbackQuery("menu_delete", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "delete_platform" };
  await ctx.editMessageText(
    "🗑 Delete Task (permanent)\n\n⚠️ Consider 🚫 Disable instead.\n\nChoose platform:",
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
    .text("🚫 Disable instead (safer)",  `disconfirm_${taskId}`).row()
    .text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `⚠️ DELETE "${task.title}"?\nPoints: +${task.points}\n\nThis CANNOT be undone.`,
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
    await ctx.editMessageText("📋 No tasks found.", {
      reply_markup: new InlineKeyboard().text("🔙 Back", "menu_back"),
    });
    return ctx.answerCallbackQuery();
  }

  let msg = "📋 All Tasks:\n\n";
  let cur = "";
  tasks.forEach((t: any) => {
    if (t.platform !== cur) {
      cur = t.platform;
      msg += `${PLATFORM_EMOJI[t.platform as Platform]} ${t.platform.toUpperCase()}\n`;
    }
    const icon = t.status === "active" ? "🟢" : "🔴";
    const taskInfo = t.task_reward > 0 ? ` +${t.task_reward}T` : "";
    msg += `  ${icon} ${t.title} (+${t.points}${taskInfo})\n`;
  });

  await ctx.editMessageText(msg, {
    reply_markup: new InlineKeyboard().text("🔙 Back", "menu_back"),
  });
  await ctx.answerCallbackQuery();
});


bot.callbackQuery("msg_confirm", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const s = ctx.session;
  if (!s.title || !s.msgBody) {
    await ctx.editMessageText("❌ Session expired. Use /message again.");
    return ctx.answerCallbackQuery();
  }
  const { error } = await supabase.from("announcements").insert({
    title:   s.title,
    message: s.msgBody,
  });
  ctx.session = {};
  if (error) {
    await ctx.editMessageText("❌ Error: " + error.message);
  } else {
    await ctx.editMessageText("✅ Announcement sent!\n\n📌 " + s.title);
  }
  await ctx.answerCallbackQuery();
});

// ═══════════════════════════════════════════════════
// 📢 /message COMMAND — Announcements
// ═══════════════════════════════════════════════════

bot.command("message", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  ctx.session = { step: "msg_title" };
  await ctx.reply("📢 New Announcement\n\nSend the title:");
});

// In the text handler, add these steps:
// msg_title → msg_body → msg_confirm
// Already handled in the main text handler below as an extension.

// Add /edit_message command
bot.command("edit_message", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { data: msgs } = await supabase
    .from("announcements")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!msgs || msgs.length === 0) {
    return ctx.reply("📋 No announcements found.");
  }

  const kb = new InlineKeyboard();
  msgs.forEach((m: any) => {
    const date = new Date(m.created_at).toLocaleDateString("en-GB");
    kb.text(`${date} — ${m.title.slice(0, 30)}`, `editmsg_${m.id}`).row();
  });
  kb.text("🗑 Delete a message", "deletemsg_list");

  await ctx.reply("✏️ Edit Announcement — Choose:", { reply_markup: kb });
});

bot.callbackQuery(/^editmsg_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const msgId = ctx.match[1];
  const { data: msg } = await supabase
    .from("announcements").select("*").eq("id", msgId).single();
  if (!msg) return ctx.editMessageText("❌ Not found.");

  ctx.session = { step: "editmsg_field", editTaskId: msgId };
  const kb = new InlineKeyboard()
    .text("📝 Edit Title",   `editmsgfield_${msgId}_title`).row()
    .text("📄 Edit Message", `editmsgfield_${msgId}_message`).row()
    .text("🗑 Delete",       `deletemsg_${msgId}`).row()
    .text("❌ Cancel", "cancel");

  await ctx.editMessageText(
    `📢 "${msg.title}"\n\n${msg.message}\n\nWhat to edit?`,
    { reply_markup: kb }
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^editmsgfield_(.+)_(title|message)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const [, msgId, field] = ctx.match;
  ctx.session = { step: "editmsg_value", editTaskId: msgId, editField: field };
  await ctx.editMessageText(
    field === "title" ? "📝 Send the new title:" : "📄 Send the new message:"
  );
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("deletemsg_list", async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const { data: msgs } = await supabase
    .from("announcements")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!msgs || msgs.length === 0) {
    await ctx.editMessageText("No announcements.");
    return ctx.answerCallbackQuery();
  }

  const kb = new InlineKeyboard();
  msgs.forEach((m: any) => {
    const date = new Date(m.created_at).toLocaleDateString("en-GB");
    kb.text(`🗑 ${date} — ${m.title.slice(0, 25)}`, `deletemsg_${m.id}`).row();
  });
  kb.text("❌ Cancel", "cancel");
  await ctx.editMessageText("🗑 Choose announcement to delete:", { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^deletemsg_(.+)$/, async (ctx) => {
  if (!await requireAdmin(ctx)) return;
  const msgId = ctx.match[1];
  const { data: msg } = await supabase
    .from("announcements").select("title").eq("id", msgId).single();
  const { error } = await supabase.from("announcements").delete().eq("id", msgId);
  ctx.session = {};
  if (error) {
    await ctx.editMessageText(`❌ Error: ${error.message}`);
  } else {
    await ctx.editMessageText(`✅ "${msg?.title}" deleted.`);
  }
  await ctx.answerCallbackQuery();
});

// ─── START ──────────────────────────────────────────
bot.start();
console.log(`✅ AZOX Admin Bot running (Admin: ${ADMIN_ID})`);
