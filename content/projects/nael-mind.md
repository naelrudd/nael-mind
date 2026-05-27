# Project: Nael Mind

Status: Active — MVP phase
Last updated: 2026-05-27

## Overview
Personal knowledge system that acts as a single source of truth
for all AI interactions. Any chatbot can understand Nael
without repeated re-explaining.

## Problem Solved
"Tired of explaining myself to every new chatbot session."

## Core Goal

Single source of truth for all chatbots.

## Future

- All chatbots can access the same memory
- Context stays consistent across sessions

## Architecture (current)
GitHub repo (`content/` MD files)
        ↓
Raw URL fetch by chatbot
        ↓
Injected as context at start of session

## File Structure
├── content/Identity.md
├── content/preferences.md
├── content/goals.md
├── content/current-focus.md
├── content/master-context.md
├── content/memories/
└── content/projects/

## Update Flow
Edit MD in `content/` → commit to GitHub → all bots get latest

## Future Ideas
- Auto memory logging after each session
- Structured tags for better retrieval
- Connect to Claude MCP / ChatGPT connector

## Stack
- GitHub (storage)
- Markdown (format)
- Raw URL (delivery)
- No server, no cost
