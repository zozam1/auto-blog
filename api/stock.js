export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const keyword = getStockKeyword();
    const blogPost = await generateBlogPost(keyword);
    const accessToken = await getAccessToken();
    const result = await postToBlogger(blogPost, accessToken);
    return res.status(200).json({ success: true, keyword, title: blogPost.title, url: result.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function getStockKeyword() {
  const keywords = [
    "what is a stock and how does it work",
    "how to invest in S&P 500 for beginners",
    "what is an ETF and why should you invest",
    "how dividend investing works",
    "what is a P/E ratio and why it matters",
    "dollar cost averaging strategy explained",
    "value investing vs growth investing",
    "how to read a stock chart for beginners",
    "what is market capitalization",
    "how interest rates affect stock prices",
    "what is inflation and how it impacts investments",
    "best sectors to invest in 2026",
    "how to invest in AI stocks",
    "what is a recession and how to protect your money",
    "index funds vs actively managed funds",
    "how Warren Buffett picks stocks",
    "what is compound interest and why it matters",
    "how to start investing with 100 dollars",
    "what is a bear market vs bull market",
    "semiconductor stocks outlook 2026",
    "how Federal Reserve decisions affect markets",
    "what is short selling stocks",
    "how to invest in real estate without buying property",
    "what are blue chip stocks",
    "how to build a diversified portfolio",
    "what is a Roth IRA and how it works",
    "how to analyze a company before investing",
    "what is a stock split and why companies do it",
    "energy sector investment opportunities",
    "how to invest in gold and commodities",
    "what is a hedge fund",
    "passive income through dividend stocks",
    "how crypto affects stock market",
    "what is quantitative easing",
    "best long term stocks to hold forever",
    "how to invest in emerging markets",
    "what is ESG investing",
    "how to spot undervalued stocks",
    "what is a stock buyback",
    "how to use dollar cost averaging in volatile markets",
    "what is options trading for beginners",
    "how to invest in tech stocks safely",
    "what is a mutual fund",
    "how earnings reports affect stock prices",
    "what is the difference between stocks and bonds",
    "how to protect your portfolio during recession",
    "what is market volatility and how to handle it",
    "how to invest in healthcare stocks",
    "what is a 401k and how to maximize it",
    "how to read a company balance sheet"
  ];
  return keywords[Math.floor(Math.random() * keywords.length)];
}

function getWritingStyle() {
  const styles = [
    {
      voice: "a personal finance enthusiast who learned investing the hard way — through real mistakes and wins",
      tone: "casual and honest, like writing a personal journal entry you're sharing with friends",
      structure: "start with a personal story or moment of confusion about this topic, then naturally explain it, end with your honest take",
      avoid: "bullet point lists, numbered tips, FAQ sections, headers like 'Introduction' or 'Conclusion', phrases like 'In this article' or 'Today we will'"
    },
    {
      voice: "a skeptical but curious everyday investor who questions common financial advice",
      tone: "direct and slightly opinionated, occasionally sarcastic but always helpful",
      structure: "open with a myth or misconception people have, then dig into the reality, share a specific example, give a practical thought to leave with",
      avoid: "overly formal language, excessive headers, generic tips, phrases like 'it is important to note' or 'it is worth mentioning'"
    },
    {
      voice: "a former finance student who now writes for regular people, not Wall Street types",
      tone: "conversational with occasional dry humor, explains jargon without being condescending",
      structure: "pick one specific angle of this topic (not the whole thing), go deep on that angle, use a concrete analogy or real-world comparison",
      avoid: "covering everything about the topic, bullet lists, formulaic structure, words like 'comprehensive' or 'ultimate guide'"
    },
    {
      voice: "someone who has been investing for 10+ years and is sharing lessons from experience",
      tone: "warm and candid, occasionally admits uncertainty or past mistakes",
      structure: "lead with something surprising or counterintuitive you learned, then explain the reasoning behind it, give context for when it applies",
      avoid: "generic advice, excessive subheadings, robotic transitions like 'Furthermore' or 'In addition', list-heavy formatting"
    }
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}

async function generateBlogPost(keyword) {
  const style = getWritingStyle();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: `You are ${style.voice}. You write blog posts about personal finance and investing for a general audience.

Your writing style: ${style.tone}
Structure approach: ${style.structure}
What to avoid: ${style.avoid}

Write like a real person, not an AI assistant. Vary your sentence lengths — mix short punchy sentences with longer explanatory ones. Use contractions naturally (it's, don't, you'll, I've). Include a specific number, statistic, or real-world reference where it fits naturally. Express an actual opinion somewhere in the piece.

Output ONLY raw JSON. No markdown. No code blocks.`,
      messages: [{
        role: 'user',
        content: `Write a blog post about: "${keyword}"

Length: 450-650 words
Format: clean HTML using only <p>, <h2>, <strong>, <em> tags — minimal heading usage, mostly flowing paragraphs
Title: natural and specific (not clickbait, not generic — something a real person would write)

Respond ONLY with this exact JSON structure:
{"title": "...", "content": "full HTML content here", "labels": ["Finance", "Investing"]}`
      }]
    }),
  });

  const data = await response.json();
  const raw = data.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

async function postToBlogger(blogPost, accessToken) {
  const response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${process.env.BLOGGER_BLOG_ID}/posts/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: blogPost.title, content: blogPost.content, labels: blogPost.labels || [] }),
  });
  const data = await response.json();
  if (!data.url) throw new Error('Failed to post: ' + JSON.stringify(data));
  return data;
}
