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

async function generateBlogPost(keyword) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: `Write a short, engaging, and easy-to-understand English blog post about: "${keyword}".

Requirements:
- Title: clear and beginner-friendly
- Length: 400-600 words (short and snappy)
- Style: simple language, like explaining to a friend
- Include: 1-2 practical tips or key takeaways
- Format as clean HTML using <p>, <h2>, <ul>, <li>, <strong> tags
- Add a fun fact or surprising statistic if relevant

Respond ONLY with valid JSON (no markdown): {"title": "...", "content": "full HTML content", "labels": ["Finance", "Investing", "Stock Market"]}` }] }),
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
