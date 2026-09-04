# SessionStart hook fallback for Windows PowerShell. Injects the full
# i-have-adhd ruleset at the start of every session. Always-on is the default;
# opt out by creating $CLAUDE_CONFIG_DIR/.i-have-adhd-off (default ~/.claude).
# The older opt-in flag, .i-have-adhd-always, is still accepted and changes
# nothing. Never blocks session start: any failure exits 0.

try {
  $claudeDir = if ($env:CLAUDE_CONFIG_DIR) {
    $env:CLAUDE_CONFIG_DIR
  } else {
    Join-Path ([Environment]::GetFolderPath("UserProfile")) ".claude"
  }
  $offPath = Join-Path $claudeDir ".i-have-adhd-off"

  # On by default. Stay silent only when the user has opted out.
  if (Test-Path -LiteralPath $offPath -PathType Leaf) {
    exit 0
  }

  # Also silent when settings.json selects the plugin's output style: the
  # rules are already in the system prompt (with or without a plugin prefix).
  $settingsPath = Join-Path $claudeDir "settings.json"
  if (Test-Path -LiteralPath $settingsPath -PathType Leaf) {
    $settings = [System.IO.File]::ReadAllText($settingsPath)
    if ($settings -match '"outputStyle"\s*:\s*"([^"]*:)?i-have-adhd"') {
      exit 0
    }
  }

  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $skillPath = Join-Path $scriptDir "../skills/i-have-adhd/SKILL.md"
  if (-not (Test-Path -LiteralPath $skillPath -PathType Leaf)) {
    exit 0
  }

  $lines = [System.IO.File]::ReadAllLines($skillPath)
  $bodyStart = 0

  if ($lines.Length -gt 0 -and $lines[0] -match '^---\s*$') {
    # Only treat the block as frontmatter when the closing delimiter exists;
    # an unterminated fence is not frontmatter, so keep the whole file.
    for ($i = 1; $i -lt $lines.Length; $i++) {
      if ($lines[$i] -match '^---\s*$') {
        $bodyStart = $i + 1
        break
      }
    }
  }

  $body = if ($bodyStart -lt $lines.Length) {
    [string]::Join([Environment]::NewLine, $lines[$bodyStart..($lines.Length - 1)])
  } else {
    ""
  }

  $banner = 'ADHD MODE ACTIVE (always-on). The ruleset below applies to every response. ' +
    '"stop adhd mode" turns it off for this session; create '
  [Console]::Out.Write($banner + $offPath + " to turn always-on off for good.`n`n" + $body + "`n")
} catch {
  # Never block session start.
  exit 0
}
