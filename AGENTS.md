## 1. Tools and Web Search

### RepoPrompt MCP (Priority)

**Prioritize RepoPrompt MCP** for all repository operations:

- File operations (read, write, edit, create, delete)
- Code exploration and search
- Selection management and context curation
- Code structure analysis (codemaps)
- Workspace context snapshots
- Chat-based code planning and editing

Use RepoPrompt MCP tools (`mcp_RepoPrompt_*`) as the **primary interface** for interacting with the codebase. Only fall back to other tools if RepoPrompt MCP doesn't provide the needed functionality.

### Context7 MCP

Use Context7 MCP tools when you need to:
- Inspect or modify multiple files
- Run commands or scripts
- Set up configuration or environment
- Retrieve local library/API documentation

For **simple, one-file code snippets**, you MAY answer directly without calling Context7. For **anything that touches the repo**, prefer Context7 so changes stay consistent.

### Exa MCP (Web Search)

Use Exa for **all web/internet research**:

- Library documentation or API references
- Tutorials, examples, best practices
- Error message troubleshooting
- Up-to-date information about APIs, frameworks, or tools

## 2. Solo Scale Workflow (Dev Docs)

Use the Solo Scale system for any non-trivial feature or bugfix.

### Plan First

- Never start coding without a clear implementation plan.
- Use a "planning mode" / strategic planner role to outline the approach.

### Dev Docs Structure

For each active task, maintain:

`dev/active/[task-name]/` with:

1. `[task-name]-plan.md`  
   - The accepted implementation plan.

2. `[task-name]-context.md`  
   - Key decisions, related files, links to docs.

3. `[task-name]-tasks.md`  
   - A checklist of work items.

### Context Loop

When working:

1. Generate or update the plan.
2. Keep the three dev docs files in sync with what you're doing.
3. Periodically update `*-context.md` and `*-tasks.md` as decisions change.
4. If context/token limit becomes a problem, use the dev docs to rebuild context in a new session.

### Task Completion

When a task is fully completed:

1. Move the task directory from `dev/active/[task-name]/` to `dev/completed/[task-name]/`
2. Ensure the tasks file reflects all completed items
3. Add a completion summary to the context file if needed

## 3. Quality Assurance (#NoMessLeftBehind)

After making code changes, ensure you:

1. **Run the relevant build/test scripts**  
   - Check `README.md` or project scripts for the correct command(s).
   - If multiple repos/services are involved, identify which ones changed and run their builds.

2. **If errors occur:**
   - If there are only a few errors (≈ < 5), fix them directly.
   - If there are many errors, recommend using the configured "auto-error-resolver" or equivalent specialized agent.

3. **Risky Areas Reminder**  
   - For try/catch blocks, database operations, or external calls:
     - Consider logging/monitoring (e.g., Sentry or equivalent).
     - Use transactions where appropriate.
     - Handle failures gracefully.