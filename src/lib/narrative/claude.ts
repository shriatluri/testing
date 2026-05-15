import { execSync } from "child_process";
import { writeFileSync } from "fs";

export interface ClaudeNarrativeResponse {
  narratives: Array<{
    ticker: string;
    narrative: string;
    trajectory: "improving" | "stable" | "deteriorating";
    signal: "BUY" | "SELL" | "HOLD";
    signalRationale: string;
  }>;
  portfolioAnalysis: string;
}

export function callClaude(prompt: string): string {
  const tmpFile = "/tmp/portfolio-prompt.txt";
  writeFileSync(tmpFile, prompt);

  return execSync(`cat "${tmpFile}" | claude -p`, {
    encoding: "utf-8",
    timeout: 300000,
    env: {
      ...process.env,
      CLAUDECODE: undefined,
      ANTHROPIC_API_KEY: undefined,
    },
  });
}

export function parseClaudeResponse(output: string): ClaudeNarrativeResponse {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in claude output");
  return JSON.parse(jsonMatch[0]);
}

export function sendGmailDraft(email: string, subject: string, body: string) {
  const promptFile = "/tmp/portfolio-email-prompt.txt";
  writeFileSync(
    promptFile,
    `Create a Gmail draft to ${email} with the subject "${subject}". Use the following content as the email body exactly as-is:\n\n${body}\n\nAdd this note at the very bottom: "To ask follow-up questions, copy the full context from your dashboard and paste it into any LLM."`
  );

  execSync(
    `cat "${promptFile}" | claude -p --allowedTools "mcp__claude_ai_Gmail__create_draft"`,
    {
      encoding: "utf-8",
      timeout: 120000,
      env: {
        ...process.env,
        CLAUDECODE: undefined,
        ANTHROPIC_API_KEY: undefined,
      },
    }
  );
}
