export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const trendingKeyword = await getTrendingKeyword();
    const blogPost = await generateBlogPost(trendingKeyword);
    const accessToken = await getAccessToken();
    const result = await postToBlogger(blogPost, accessToken);
    return res.status(200).json({ success: true, keyword: trendingKeyword, title: blogPost.title, url: result.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getTrendingKeyword() {
  const response = await fetch(
    `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=US&api_key=${process.env.SERPAPI_KEY}`
  );
  const data = await response.json();
  if (!data.trending_searches || data.trending_searches.length === 0) {
    throw new Error('Could not get trending keywords');
  }

  const financeKeywords = [
    'stock', 'market', 'invest', 'fund', 'bank', 'economy', 'fed', 'rate',
    'inflation', 'recession', 'crypto', 'bitcoin', 'etf', 'nasdaq', 'dow',
    'earnings', 'ipo', 'bond', 'debt', 'gdp', 'trade', 'tariff', 'oil',
    'gold', 'dollar', 'finance', 'money', 'budget', 'tax', 'profit', 'loss',
    'revenue', 'quarter', 'wall street', 'hedge', 'dividend', 'sec', 'treasury'
  ];

  const financeRelated = data.trending_searches.filter(item => {
    const q = item.query.toLowerCase();
    return financeKeywords.some(k => q.includes(k));
  });

  const pool = financeRelated.length >= 2 ? financeRelated : data.trending_searches.slice(0, 10);
  const random = pool[Math.floor(Math.random() * pool.length)];
  return random.query;
}

function getWritingStyle() {
  const styles = [
    {
      voice: "a curious person who just went down a rabbit hole about this topic and is sharing what they found",
      tone: "genuine and exploratory — you're figuring things out as you write, not lecturing",
      structure: "open with what made you look this up, share 2-3 things you found genuinely interesting or surprising, close with your current thinking on it",
      avoid: "expert-sounding authority, comprehensive coverage, FAQ sections, bullet point lists, headers every other paragraph"
    },
    {
      voice: "an opinionated generalist writer who covers whatever catches their eye",
      tone: "confident with a clear point of view, slightly edgy but grounded in actual information",
      structure: "take one specific angle or unpopular opinion about this topic, back it up with reasoning and real examples, acknowledge the other side briefly",
      avoid: "fence-sitting, wishy-washy language, excessive balance, 'on one hand... on the other hand' paralysis, numbered tips"
    },
    {
      voice: "a journalist who writes human-interest stories about everyday topics",
      tone: "narrative-driven and story-focused, puts real human context around facts",
      structure: "open with a scene or scenario that makes this topic real, bring in the facts through the story, land on something that sticks",
      avoid: "clinical explanations, abstract statistics without context, listicles, formal headers, phrases like 'it is important to'"
    },
    {
      voice: "a Reddit-style commenter who writes longer posts — knowledgeable but relatable",
      tone: "casual and direct, occasionally self-deprecating, acknowledges what you don't know",
      structure: "get to the point fast, explain your reasoning in a natural order, include at least one 'by the way' type aside",
      avoid: "formal language, generic insight, conclusion paragraphs that summarize what you just said, 'In this post I will'"
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
      max_tokens: 4000,
      system: `You are ${style.voice}. You write about trending topics for a general online audience.

Your writing style: ${style.tone}
Structure approach: ${style.structure}
What to avoid: ${style.avoid}

Critical rules for sounding human:
- Vary sentence length constantly. Short. Then something longer that builds on it. Then maybe something in between.
- Use contractions: it's, don't, you'll, they're, I'd, can't
- It's okay to start a sentence with "And" or "But" occasionally
- Express a real opinion or reaction, not just information
- Reference something specific — a real event, a real number, a real name where it fits
- Do NOT use the word "delve", "crucial", "comprehensive", "it's worth noting", "game-changer", "in conclusion", "to summarize"
- Do NOT start with "In today's..." or "Have you ever wondered..."

Output ONLY raw JSON. No markdown. No code blocks.`,
      messages: [{
        role: 'user',
        content: `Write a blog post about this trending topic: "${keyword}"

Length: 1000-1400 words
Format: HTML using <p>, <h2>, <strong>, <em> tags. Use <h2> sparingly — 2 or 3 max, only when the topic genuinely shifts. Mostly flowing paragraphs.
Title: something a real person would write — specific, honest, maybe a little unexpected. Not a generic SEO title.

Respond ONLY with this exact JSON structure:
{"title": "...", "content": "full HTML content here", "labels": ["tag1", "tag2", "tag3"], "description": "meta description under 155 characters"}`
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
