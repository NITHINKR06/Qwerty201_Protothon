"""
Main Orchestrator Agent — Google ADK
=====================================
This agent coordinates sub-agents and tools to handle
incoming requests (text or voice) and produce responses.
"""

import os
from dotenv import load_dotenv
from google import genai
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

load_dotenv()

# ── Agent Definition ──────────────────────────────────

root_agent = Agent(
    name="main_agent",
    model="gemini-2.0-flash",
    description="Primary orchestrator agent for the hackathon project.",
    instruction="""You are a helpful AI assistant for the hackathon project.
    You can coordinate with sub-agents and use tools to fulfill user requests.
    Be concise, accurate, and helpful.""",
    # sub_agents=[],   # Add sub-agents here
    # tools=[],        # Add custom tools here
)


# ── Runner (for standalone testing) ──────────────────

if __name__ == "__main__":
    session_service = InMemorySessionService()

    runner = Runner(
        agent=root_agent,
        app_name="hackathon_app",
        session_service=session_service,
    )

    print("✅ Main agent loaded. Use `adk web` for the interactive UI.")
