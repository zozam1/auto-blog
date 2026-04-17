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
      voice: "a fun, relatable 20-something who's figuring out investing and loves sharing what they learn with friends",
      tone: "bubbly and warm, like texting your bestie about money stuff — enthusiastic but real. Use 1-2 emojis naturally in the post (not forced, not every sentence)",
      structure: "open with a relatable moment or feeling ('okay so I was literally today years old when I learned...'), explain it in a fun way, end with an encouraging note",
      avoid: "stiff language, numbered tips, FAQ sections, boring intros like 'In this article', corporate-speak"
    },
    {
      voice: "a witty personal finance writer who makes money topics feel less scary and actually fun",
      tone: "playful and a little cheeky, like a friend who happens to know a lot about money. Toss in 1-2 emojis where they feel natural",
      structure: "hook with something surprising or funny about this topic, break it down without being boring, leave them with one thing they'll actually remember",
      avoid: "dry explanations, excessive headers, generic tips, phrases like 'it is important to note', being preachy"
    },
    {
      voice: "a cheerful finance nerd who gets genuinely excited about money topics and wants everyone else to too",
      tone: "enthusiastic and encouraging, like a hype person for your financial life. Use 1-2 relevant emojis naturally",
      structure: "start with why this topic is actually cooler than it sounds, share something interesting you know about it, end with a practical takeaway that feels doable",
      avoid: "making it sound complicated, bullet lists, robotic transitions, words like 'comprehensive' or 'crucial', sounding like a textbook"
    },
    {
      voice: "a chill but knowledgeable friend who gives you the real talk about finance without making you feel dumb",
      tone: "casual and honest, occasionally self-deprecating, always warm. Sprinkle in 1-2 emojis where it fits",
      structure: "start with the real talk version of this topic (skip the fluff), share what actually matters, end with your honest opinion on it",
      avoid: "condescending explanations, excessive subheadings, formal transitions, FAQ sections, sounding like a financial advisor"
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
