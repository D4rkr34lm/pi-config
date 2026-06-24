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

Status: `in progress`\
Version: `1.0.0`

Give the agent tools to manage a divide and conquer strategy for tasks that are too big to be solved in a go and allow for step by step validation.

- [ ] Agent can write bulk todos
- [ ] Agent can edit a todo
- [ ] Agent can mark a todo as `done` or `aborted`
- [ ] Agent can list all todos
- [ ] Agent can list all `open` todos

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
