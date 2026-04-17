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
      voice: "a curious and bubbly person who just went down a rabbit hole about this financial topic and can't wait to share it",
      tone: "excited and genuine, like spilling tea to a friend about something wild you just learned. Use 1-2 emojis naturally",
      structure: "open with what sparked your curiosity ('okay so I fell into a rabbit hole last night...'), share the most interesting thing you found, close with your honest reaction",
      avoid: "expert-sounding authority, comprehensive coverage, FAQ sections, bullet point lists, boring intros"
    },
    {
      voice: "a fun finance writer with strong opinions and a great sense of humor about money",
      tone: "witty and confident, a little cheeky but always backed by real info. Toss in 1-2 emojis where they feel natural",
      structure: "open with a spicy take or surprising angle on this topic, back it up with what you actually know, leave them with something worth thinking about",
      avoid: "fence-sitting, dry explanations, numbered tips, robotic transitions, sounding like a Wikipedia article"
    },
    {
      voice: "a warm and encouraging finance friend who wants to make money stuff feel less intimidating",
      tone: "cheerful and supportive, like a hype person for your financial future. Sprinkle in 1-2 relevant emojis",
      structure: "start by acknowledging that this topic sounds scarier than it is, make it feel approachable with a real example, end with something encouraging",
      avoid: "making it sound complicated, bullet lists, formal headers, corporate jargon, condescending explanations"
    },
    {
      voice: "a chill and relatable person giving real talk about finance, no fluff",
      tone: "casual and direct, occasionally funny, always honest. Use 1-2 emojis naturally in the flow",
      structure: "get right to the interesting part, share what actually matters about this topic, end with your real take on it",
      avoid: "long boring intros, excessive subheadings, formal transitions, FAQ sections, summarizing what you just said"
    }
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}

async function fetchImage(keyword) {
  const query = keyword.replace(/[^a-zA-Z ]/g, '').split(' ').slice(0, 3).join(' ');
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`, {
    headers: { Authorization: process.env.PEXELS_API_KEY }
  });
  const data = await response.json();
  if (!data.photos || data.photos.length === 0) return null;
  const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
  return {
    url: photo.src.large,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url
  };
}

async function generateBlogPost(keyword) {
  const style = getWritingStyle();
  const image = await fetchImage(keyword);

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
  const post = JSON.parse(raw);

  if (image) {
    const imageHtml = `<div style="margin-bottom:24px;border-radius:12px;overflow:hidden;">
<img src="${image.url}" alt="${keyword}" style="width:100%;height:auto;display:block;" />
<p style="font-size:0.72rem;color:#9ca3af;margin:6px 0 0;text-align:right;">
Photo by <a href="${image.photographerUrl}" target="_blank" rel="noopener" style="color:#9ca3af;">${image.photographer}</a> on <a href="https://www.pexels.com" target="_blank" rel="noopener" style="color:#9ca3af;">Pexels</a>
</p></div>`;
    post.content = imageHtml + post.content;
  }

  return post;
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
