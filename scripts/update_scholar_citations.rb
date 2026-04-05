#!/usr/bin/env ruby
# frozen_string_literal: true

require "open-uri"

INDEX_PATH = File.expand_path("../index.html", __dir__)
USER_AGENT = "Mozilla/5.0 (compatible; CV citation updater/1.0; +https://scholar.google.com/)".freeze

html = File.read(INDEX_PATH)

scholar_user_id = html[/https:\/\/scholar\.google\.com\/citations\?user=([^"'& ]+)/, 1]
abort("Could not find a Google Scholar user id in index.html") unless scholar_user_id

fetch_url = "https://scholar.google.com/citations?user=#{scholar_user_id}&hl=en"

begin
  profile_html = URI.open(fetch_url, "User-Agent" => USER_AGENT, read_timeout: 15).read
rescue StandardError => e
  abort("Failed to fetch Google Scholar profile: #{e.class}: #{e.message}")
end

count =
  profile_html[/<table id="gsc_rsb_st">.*?<td class="gsc_rsb_std">(\d+)<\/td>/m, 1] ||
  profile_html[/Cited by (\d+)/, 1]

abort("Could not extract citation count from Google Scholar HTML") unless count

updated_html =
  html.sub(/(<span class="citation-number" data-target=")\d+(">\d*<\/span>)/, "\\1#{count}\\2")

abort("Could not find the citation number element in index.html") if updated_html == html && !html.match?(/data-target="#{Regexp.escape(count)}"/)

File.write(INDEX_PATH, updated_html)
puts "Updated homepage citation count to #{count}"
