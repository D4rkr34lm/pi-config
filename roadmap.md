# Roadmap

## Extensions

### Analytics

Status: `implemented`\
Version: `1.0.0`

A extension to gather information for making informed decisions about the development of the agent.

- [x] Track tool calling
- [x] Track skill usage
- [x] Track template prompt usage
- [ ] Track model invoked skills

### Usage

Status: `implemented`\
Version: `1.0.0`

Aggregate total usage of the agent.

- [x] Cumulated sessions
- [x] Cumulated messages sent
- [x] Cumulated tokens used
- [x] Cumulated cost

### Todos

Status: `implemented`\
Version: `1.1.0`

Give the agent tools to manage a divide and conquer strategy for tasks that are too big to be solved in a go and allow for step by step validation.

- [X] Agent can write bulk todos
- [X] Agent can edit a todo
- [X] Agent can mark a todo as `done` or `aborted`
- [ ] Agent can list all todos
- [X] Agent can list all `open` todos
- [ ] Todo completion invokes a verification step (toggle-able).

### Watchdog

Status: `not implemented`\
Version: `1.0.0`

Some files should never be read by the model. Some commands are way to dangerous to just execute as is. Watchdog must therefore enforce access restrictions and check commands before execution. While I am aware that only isolation brings real security, this is a first step to prevent accidental damage and allow for a more safeguarded usage when true isolation is not available.

- [x] read on protected files is denied
- [x] write on protected files is denied
- [x] edit on protected files is denied
- [x] shell command are heuristically checked for forbidden paths 
- [ ] every command is first looked at by an assessor model. Generating a short summary and classifies the command as `safe` or `unsafe`. If `unsafe`, the user is asked wether they want to execute the command or not. If `safe`, the command is executed.

### Subagents

Status: `not implemented`\
Version: `1.0.0`

Some tasks do not really require an agent to have all the outputs/sub-steps within its context window. For such cases it would be very helpful to have subagents that can be manually invoked or invoked by the model. The extension is only a enabler. The actual subagents should be define-able in `/subagents` 

## Template Prompts

### Review

Status: `implemented`\
Version: `1.0.0`
Current Score `-`

Instructions that lead to:

- Agent compares current branch with merge base
- Agent reports on quality of code, tests, and documentation
- Agent reports on potential issues and improvements

## Fuzzy testing & scoring

Tests to ensure prompt and tool quality and effectiveness
