import express from "express";
import { getThreadMessages } from "../services/slackService.js";
import { generateSummary } from "../services/openaiService.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

router.post("/summarize", async (req, res) => {
  try {
    const { channel, threadTs } = req.body;

    if (!channel || !threadTs) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const messages = await getThreadMessages(channel, threadTs);
    console.log(messages);
    const summary = await generateSummary(messages);

    res.json({ summary });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/thread-info", (req, res) => {
  const { threadUrl } = req.query;

  if (!threadUrl) {
    return res.status(400).json({ error: "Missing thread URL" });
  }

  try {
    // Extract channel ID and thread timestamp from URL
    // Example URL: https://workspace.slack.com/archives/C0123ABCDEF/p1234567890123456
    const urlParts = threadUrl.split("/");
    const channel = urlParts[urlParts.length - 2];
    const threadTs = urlParts[urlParts.length - 1]
      .substring(1)
      .replace(/(\d{6})$/, ".$1");

    res.json({
      channel,
      threadTs,
      usage: {
        curl: `curl -X POST http://localhost:3000/api/summarize -H "Content-Type: application/json" -d '{"channel": "${channel}", "threadTs": "${threadTs}"}'`,
      },
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid thread URL format" });
  }
});

export default router;
