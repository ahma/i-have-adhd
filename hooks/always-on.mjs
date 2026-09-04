// SessionStart / SubagentStart hook: injects the full i-have-adhd ruleset when
// the user has opted in by creating $CLAUDE_CONFIG_DIR/.i-have-adhd-always
// (default ~/.claude). Never blocks session start: any failure exits 0.
//
// Runs under Node so it works on macOS, Linux, and Windows. The shared Claude
// Code/Codex hook launches this module from the plugin-root environment rather
// than relying on platform-specific shell expansion for the script path.
// Native sh and PowerShell implementations remain available as fallbacks for
// SessionStart only.
//
// Output shape depends on the event, read from the hook's stdin JSON:
//   SessionStart  -> plain text banner + ruleset (added to context as-is).
//   SubagentStart -> {"hookSpecificOutput":{"hookEventName":"SubagentStart",
//                    "additionalContext": ...}} so the ruleset reaches the
//                    subagent's context, which a SessionStart injection never
//                    does. No stdin, or stdin that is not JSON, is treated as
//                    SessionStart, so direct invocation keeps working.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readEventName() {
  try {
    if (process.stdin.isTTY) return "SessionStart";
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return "SessionStart";
    const parsed = JSON.parse(raw);
    return typeof parsed.hook_event_name === "string"
      ? parsed.hook_event_name
      : "SessionStart";
  } catch {
    return "SessionStart";
  }
}

try {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const flagPath = path.join(claudeDir, ".i-have-adhd-always");

  // Only fire when the user has opted in.
  if (!fs.existsSync(flagPath)) process.exit(0);

  // Resolve SKILL.md relative to this script's own location, not a trusted env var.
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const skillPath = path.join(scriptDir, "..", "skills", "i-have-adhd", "SKILL.md");
  if (!fs.existsSync(skillPath)) process.exit(0);

  // Strip a leading YAML frontmatter block (--- ... --- at the very top of file).
  const body = fs
    .readFileSync(skillPath, "utf8")
    .replace(
      /^---[^\S\r\n]*\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/,
      "",
    )
    .replace(/(?:\r?\n)+$/, "");

  if (readEventName() === "SubagentStart") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SubagentStart",
          additionalContext:
            "ADHD MODE ACTIVE (always-on, inherited from the parent session). " +
            `The ruleset below applies to every response.\n\n${body}\n`,
        },
      }) + "\n",
    );
    process.exit(0);
  }

  process.stdout.write(
    "ADHD MODE ACTIVE (always-on). The ruleset below applies to every response. " +
      '"stop adhd mode" turns it off for this session; ' +
      `delete ${flagPath} to turn always-on off for good.\n\n${body}\n`,
  );
} catch {
  // Never block session start.
  process.exit(0);
}
