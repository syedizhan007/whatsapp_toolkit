#!/usr/bin/env python3
import json
import re
from collections import Counter
from pathlib import Path

# Transcript files to analyze
transcript_files = [
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/c4cfbbda-bf32-44dc-b086-7f50813fa1f2.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/5936fb0c-e3b3-4c4c-a886-057361f3e82e.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/a1b0b5db-030a-4c9d-af34-a2f622591c93.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/7c9aabea-894f-4544-9702-c945fce82406.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/ab9b3267-d081-44c5-97ea-1621f984ed83.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/a39d1414-78a3-43e3-a1a1-207a6031062e.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/246c1c6e-0638-415f-beeb-a0a51505f5f0.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/7cacfa62-6fc2-46c3-94da-48543649ba06.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/e0cca867-a4f1-4897-a5a5-d7355206fc74.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/79b395ab-08f7-4e16-b48b-85eef6d1f597.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/c19f8a21-545d-472d-b1e8-7847d7fb68a9.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/4956fda7-0219-4391-b05c-33b6a582b1e3.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/9a33d7e2-0cb8-4f5f-9fbf-a2705b6cb6af.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/656f2b17-e599-4049-932f-0de5044e776c.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/9e2fb18f-8399-45a9-a88e-9f03b88b4180.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/11f79321-3494-4caa-a643-2d13984a6843.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/e52cfcc1-c6b3-4b0e-b887-cfae50a8569b.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/17b28029-ceaa-4d4a-92ec-402bbf65a943.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/f7fd9938-facb-49c7-a018-dea051ef8080.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/279cf29b-1bf8-4a6e-8201-b6c83809159f.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/bd56bdf4-dc0a-4686-9c32-a73f104cd85b.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/251736ef-a353-48c0-92ab-18174c1dc128.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk/43455352-1bea-46ca-9f81-0726710fb7a4.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk/ac3dc308-67af-409e-9e8b-0c389a7927ff.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk/c6ad8820-2c90-4c4f-b443-8752d630d02c.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk/2ed67a76-0731-494e-bebd-a65b98d2e40a.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk/fcb1d626-bcf6-4522-8543-4593b664d829.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/75057655-af90-4006-a03d-ee8419fcdb1e.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/a4addb36-f059-40e8-a691-f93a27748ac8.jsonl",
    "/c/Users/kk/.claude/projects/C--Users-kk-Desktop-whatsapptool/93890156-fdf5-49e6-be59-c46645e789f4.jsonl",
]

# Commands that are already auto-allowed (don't need allowlist entries)
AUTO_ALLOWED = {
    'cal', 'uptime', 'cat', 'head', 'tail', 'wc', 'stat', 'strings', 'hexdump', 'od', 'nl',
    'id', 'uname', 'free', 'df', 'du', 'locale', 'groups', 'nproc', 'basename', 'dirname',
    'realpath', 'cut', 'paste', 'tr', 'column', 'tac', 'rev', 'fold', 'expand', 'unexpand',
    'fmt', 'comm', 'cmp', 'numfmt', 'readlink', 'diff', 'true', 'false', 'sleep', 'which',
    'type', 'expr', 'test', 'getconf', 'seq', 'tsort', 'pr', 'echo', 'printf', 'ls', 'cd',
    'find', 'pwd', 'whoami', 'alias', 'xargs', 'file', 'sed', 'sort', 'man', 'help',
    'netstat', 'ps', 'base64', 'grep', 'egrep', 'fgrep', 'sha256sum', 'sha1sum', 'md5sum',
    'tree', 'date', 'hostname', 'info', 'lsof', 'pgrep', 'tput', 'ss', 'fd', 'fdfind',
    'aki', 'rg', 'jq', 'uniq', 'history', 'arch', 'ifconfig', 'pyright'
}

# Read-only git/gh/docker commands (also auto-allowed)
GIT_READONLY = {'git status', 'git log', 'git diff', 'git show', 'git blame', 'git branch',
                'git tag', 'git remote', 'git ls-files', 'git ls-remote', 'git rev-parse',
                'git describe', 'git stash list', 'git reflog', 'git shortlog', 'git cat-file',
                'git for-each-ref', 'git worktree list'}

GH_READONLY = {'gh pr view', 'gh pr list', 'gh pr diff', 'gh pr checks', 'gh pr status',
               'gh issue view', 'gh issue list', 'gh issue status', 'gh run view',
               'gh run list', 'gh workflow list', 'gh workflow view', 'gh repo view',
               'gh release view', 'gh release list', 'gh auth status'}

DOCKER_READONLY = {'docker ps', 'docker images', 'docker logs', 'docker inspect'}

def extract_command(cmd_str):
    """Extract the base command and first subcommand from a shell command."""
    # Remove leading env vars, sudo, timeout, etc.
    cmd_str = re.sub(r'^(sudo|timeout|env|time|nice|nohup)\s+', '', cmd_str.strip())
    cmd_str = re.sub(r'^\w+=\S+\s+', '', cmd_str)

    # Handle pipes and &&
    cmd_str = cmd_str.split('|')[0].split('&&')[0].split(';')[0].strip()

    # Extract command and first arg
    parts = cmd_str.split()
    if not parts:
        return None

    cmd = parts[0]

    # For git, gh, docker, npm, etc., include the subcommand
    if len(parts) > 1 and cmd in ['git', 'gh', 'docker', 'npm', 'yarn', 'pnpm', 'bun', 'cargo', 'go', 'kubectl']:
        return f"{cmd} {parts[1]}"

    return cmd

def is_readonly_command(cmd):
    """Check if a command is read-only."""
    if not cmd:
        return False

    base_cmd = cmd.split()[0]

    # Skip auto-allowed commands
    if base_cmd in AUTO_ALLOWED:
        return False

    # Skip auto-allowed git/gh/docker commands
    if cmd in GIT_READONLY or cmd in GH_READONLY or cmd in DOCKER_READONLY:
        return False

    # Dangerous commands that should never be allowed
    dangerous = ['rm', 'rmdir', 'mv', 'cp', 'chmod', 'chown', 'kill', 'killall',
                 'git push', 'git commit', 'git add', 'git reset', 'git checkout',
                 'git merge', 'git rebase', 'git pull', 'git fetch', 'git clone',
                 'npm install', 'npm uninstall', 'yarn add', 'yarn remove',
                 'pip install', 'pip uninstall', 'apt', 'yum', 'brew',
                 'docker run', 'docker exec', 'docker rm', 'docker build',
                 'kubectl apply', 'kubectl delete', 'kubectl create',
                 'gh pr create', 'gh pr merge', 'gh pr close', 'gh issue create']

    if cmd in dangerous or base_cmd in dangerous:
        return False

    # Interpreters and shells (never wildcard these)
    interpreters = ['python', 'python3', 'node', 'bun', 'deno', 'ruby', 'perl',
                   'php', 'lua', 'bash', 'sh', 'zsh', 'fish', 'eval', 'exec',
                   'ssh', 'npx', 'bunx', 'uvx']

    if base_cmd in interpreters:
        return False

    # Read-only patterns
    readonly_patterns = [
        'git log', 'git show', 'git diff', 'git blame', 'git branch',
        'gh pr view', 'gh pr list', 'gh issue view', 'gh issue list',
        'gh run view', 'gh run list', 'gh workflow list',
        'docker ps', 'docker images', 'docker logs',
        'npm list', 'npm outdated', 'npm view',
        'kubectl get', 'kubectl describe',
        'cargo check', 'cargo test', 'go test'
    ]

    for pattern in readonly_patterns:
        if cmd.startswith(pattern):
            return True

    return False

# Parse transcripts
bash_commands = Counter()
mcp_tools = Counter()

for transcript_file in transcript_files:
    try:
        with open(transcript_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    if obj.get('role') == 'assistant' and 'content' in obj:
                        for content in obj['content']:
                            if content.get('type') == 'tool_use':
                                tool_name = content.get('name')

                                if tool_name == 'Bash':
                                    cmd = content.get('input', {}).get('command', '')
                                    extracted = extract_command(cmd)
                                    if extracted:
                                        bash_commands[extracted] += 1

                                elif tool_name and tool_name.startswith('mcp__'):
                                    mcp_tools[tool_name] += 1

                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        continue

# Filter to read-only commands with count >= 3
readonly_bash = {cmd: count for cmd, count in bash_commands.items()
                 if count >= 3 and is_readonly_command(cmd)}

readonly_mcp = {tool: count for tool, count in mcp_tools.items()
                if count >= 3 and ('read' in tool.lower() or 'get' in tool.lower() or
                                   'list' in tool.lower() or 'search' in tool.lower() or
                                   'view' in tool.lower())}

# Combine and sort by count
all_commands = []
for cmd, count in readonly_bash.items():
    all_commands.append((count, f"Bash({cmd} *)", cmd, 'bash'))

for tool, count in readonly_mcp.items():
    all_commands.append((count, tool, tool, 'mcp'))

all_commands.sort(reverse=True, key=lambda x: x[0])

# Print results
print("=" * 80)
print("READ-ONLY COMMANDS ANALYSIS")
print("=" * 80)
print()
print(f"Total Bash commands found: {len(bash_commands)}")
print(f"Total MCP tools found: {len(mcp_tools)}")
print(f"Read-only Bash commands (count >= 3): {len(readonly_bash)}")
print(f"Read-only MCP tools (count >= 3): {len(readonly_mcp)}")
print()
print("=" * 80)
print("TOP 20 COMMANDS TO ALLOWLIST")
print("=" * 80)
print()
print(f"{'#':<4} {'Pattern':<50} {'Count':<8} {'Type'}")
print("-" * 80)

for i, (count, pattern, desc, cmd_type) in enumerate(all_commands[:20], 1):
    print(f"{i:<4} {pattern:<50} {count:<8} {cmd_type}")

print()
print("=" * 80)
print("PERMISSION PATTERNS TO ADD:")
print("=" * 80)
for i, (count, pattern, desc, cmd_type) in enumerate(all_commands[:20], 1):
    print(f'  "{pattern}",')
