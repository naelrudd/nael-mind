# Project: Nael Mind

Status: Active — MVP phase
Last updated: 2026-05-27

## Overview
Personal knowledge system that acts as single source of truth
for all AI interactions. Any chatbot can understand Nael
without repeated re-explaining.

## Problem Solved
"Tired of explaining myself to every new chatbot session."

## Architecture (current)
GitHub repo (MD files)
        ↓
Raw URL fetch by chatbot
        ↓
Injected as context at start of session

## File Structure
├── identity.md
├── preferences.md
├── goals.md
├── memories/
└── projects/

## Update Flow
Edit MD → commit to GitHub → all bots get latest

## Future Ideas
- Auto memory logging after each session
- Structured tags for better retrieval
- Connect to Claude MCP / ChatGPT connector

## Stack
- GitHub (storage)
- Markdown (format)
- Raw URL (delivery)
- No server, no cost