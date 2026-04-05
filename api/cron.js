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
  const top5 = data.trending_searches.slice(0, 5);
  const random = top5[Math.floor(Math.random() * top5.length)];
  return random.query;
}

async function generateBlogPost(keyword) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: `Write a comprehensive, engaging, and SEO-optimized English blog post about: "${keyword}".

Requirements:
- Title: compelling and SEO-friendly (include the keyword naturally)
- Length: 1500-2000 words
- Structure: introduction, 5-6 sections with descriptive <h2> subheadings, conclusion
- Include: real facts, statistics, expert insights, practical tips, examples
- Add a FAQ section at the end with 3-4 common questions
- Tone: authoritative yet conversational
- End with a strong call to action
- Format as clean HTML using <p>, <h2>, <h3>, <ul>, <li>, <strong> tags

Respond ONLY with valid JSON (no markdown backticks): {"title": "...", "content": "full HTML content", "labels": ["tag1","tag2","tag3"], "description": "150 char meta description"}` }] }),
  });
  const data = await response.json();
  return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim());
}

async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
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
