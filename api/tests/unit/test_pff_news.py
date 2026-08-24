import hashlib

import pytest

from app.services.pff_news import (
    MAX_SUMMARY_CHARS,
    PFFFeedError,
    PFFRSSProvider,
    parse_pff_feed,
)


RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>PFF</title>
    <item>
      <guid isPermaLink="false">article-42</guid>
      <title>Rookie &amp; veteran compete for snaps</title>
      <link>https://www.pff.com/news/nfl-rookie?ref=feed#fragment</link>
      <pubDate>Mon, 24 Aug 2026 15:30:00 GMT</pubDate>
      <description><![CDATA[<p>A <strong>short</strong> feed summary.</p>]]></description>
      <content:encoded><![CDATA[This full article body must not be retained.]]></content:encoded>
      <category>NFL</category>
      <category>Fantasy Football</category>
    </item>
    <item>
      <guid isPermaLink="false">different-guid</guid>
      <title>Duplicate URL</title>
      <link>https://www.pff.com/news/nfl-rookie?ref=feed</link>
      <pubDate>Mon, 24 Aug 2026 16:30:00 GMT</pubDate>
      <description>Duplicate</description>
    </item>
    <item>
      <title>Missing published date</title>
      <link>https://www.pff.com/news/incomplete</link>
    </item>
  </channel>
</rss>
"""


def test_parse_pff_rss_normalizes_summaries_and_deduplicates():
    records = parse_pff_feed(RSS)

    assert len(records) == 1
    record = records[0]
    assert record["news_id"] == hashlib.sha1(b"pff|article-42").hexdigest()
    assert record["published_at"] == 1787585400000
    assert record["source"] == "pff"
    assert record["url"] == "https://www.pff.com/news/nfl-rookie?ref=feed"
    assert record["title"] == "Rookie & veteran compete for snaps"
    assert record["summary"] == "A short feed summary."
    assert record["story"] == ""
    assert "full article body" not in str(record)
    assert record["keywords"] == ["NFL", "Fantasy Football"]


def test_parse_pff_atom_and_limit_summary_length():
    summary = "x" * (MAX_SUMMARY_CHARS + 20)
    atom = f"""<feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>tag:pff.com,2026:99</id>
        <title>Training camp report</title>
        <link rel="alternate" href="https://www.pff.com/news/training-camp" />
        <published>2026-08-24T10:00:00-05:00</published>
        <summary>{summary}</summary>
      </entry>
    </feed>"""

    record = parse_pff_feed(atom)[0]
    assert record["published_at"] == 1787583600000
    assert len(record["summary"]) == MAX_SUMMARY_CHARS
    assert record["summary"].endswith("…")


def test_provider_supports_injected_transport_and_xml():
    requests = []

    def transport(request, timeout):
        requests.append((request, timeout))
        return RSS.encode()

    provider = PFFRSSProvider(timeout=4.5, transport=transport)
    assert len(provider.load_articles()) == 1
    assert requests[0][0].full_url == "https://www.pff.com/feed"
    assert requests[0][0].get_header("Accept").startswith("application/rss+xml")
    assert requests[0][1] == 4.5

    requests.clear()
    assert len(provider.load_articles(xml=RSS)) == 1
    assert requests == []


@pytest.mark.parametrize("xml", ["", "not xml", "<html><body>blocked</body></html>"])
def test_feed_failures_are_clear(xml):
    with pytest.raises(PFFFeedError, match="PFF feed"):
        parse_pff_feed(xml)


def test_transport_failure_is_wrapped():
    def fail(_request, _timeout):
        raise TimeoutError("timed out")

    with pytest.raises(PFFFeedError, match="Unable to fetch PFF feed: timed out"):
        PFFRSSProvider(transport=fail).load_articles()
