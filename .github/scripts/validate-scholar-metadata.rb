#!/usr/bin/env ruby
# Validate Google Scholar/Highwire metadata emitted by the Hugo build.

require "cgi"
require "date"
require "json"
require "yaml"

ROOT = File.expand_path("../..", __dir__)
PUBLIC_DIR = File.join(ROOT, "public")
DATA_PATH = File.join(ROOT, "data", "zenodo.json")
BASE_URL = ENV.fetch("SITE_URL", "https://genomicsxai.github.io").sub(%r{/+\z}, "")
REQUIRE_ACCEPTED_DOI = ARGV.include?("--require-accepted-doi")

def frontmatter(path)
  raw = File.read(path)
  match = raw.match(/\A---\s*\n(.*?)\n---\s*\n/m)
  abort("Missing frontmatter in #{path}") unless match

  YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
end

def meta_values(html, name)
  html.scan(/<meta\b[^>]*>/i).filter_map do |tag|
    next unless tag.match?(/\bname\s*=\s*["']?#{Regexp.escape(name)}["']?(?:\s|>|\/)/i)

    content = tag[/\bcontent\s*=\s*"([^"]*)"/i, 1] ||
              tag[/\bcontent\s*=\s*'([^']*)'/i, 1] ||
              tag[/\bcontent\s*=\s*([^\s>]+)/i, 1]
    CGI.unescapeHTML(content.to_s)
  end
end

def altmetric_dois(html)
  html.scan(/<div\b[^>]*>/i).filter_map do |tag|
    classes = tag[/\bclass\s*=\s*"([^"]*)"/i, 1] ||
              tag[/\bclass\s*=\s*'([^']*)'/i, 1] ||
              tag[/\bclass\s*=\s*([^\s>]+)/i, 1]
    next unless classes.to_s.split.include?("altmetric-embed")

    doi = tag[/\bdata-doi\s*=\s*"([^"]*)"/i, 1] ||
          tag[/\bdata-doi\s*=\s*'([^']*)'/i, 1] ||
          tag[/\bdata-doi\s*=\s*([^\s>]+)/i, 1]
    CGI.unescapeHTML(doi.to_s)
  end
end

def expected_authors(fm)
  authors = fm["authors_display"] || fm["authors"] || []
  authors.map { |author| author.is_a?(Hash) ? author["name"] : author }.compact
end

def expected_publication_date(fm)
  raw = fm["date_accepted"] || fm["date"]
  Date.parse(raw.to_s).strftime("%Y/%m/%d")
end

BLOG_DATA_PATH = File.join(ROOT, "data", "blog.yaml")

def expected_journal_title
  blog = File.exist?(BLOG_DATA_PATH) ? (YAML.safe_load(File.read(BLOG_DATA_PATH)) || {}) : {}
  blog["blog_name"].to_s
end

zenodo = File.exist?(DATA_PATH) ? JSON.parse(File.read(DATA_PATH)) : {}
journal_title = expected_journal_title
errors = []

if journal_title.empty?
  errors << "data/blog.yaml: blog_name is required for citation_journal_title"
elsif journal_title.include?("×")
  # Google Scholar's venue normalizer drops the space before "×", so it indexes
  # and exports the venue as "Genomics× AI Blog". Use an ASCII "x" instead.
  errors << "data/blog.yaml: blog_name must not contain \"×\" (U+00D7); use an ASCII \"x\""
end

Dir.glob(File.join(ROOT, "content", "blogs", "*", "index.md")).sort.each do |path|
  fm = frontmatter(path)
  next if fm["draft"] == true
  next unless fm["status"].to_s == "accepted"

  post_id = fm.fetch("post_id")
  rel_html = File.join("blogs", post_id, "index.html")
  html_path = File.join(PUBLIC_DIR, rel_html)

  unless File.exist?(html_path)
    errors << "#{path}: expected built page at public/#{rel_html}"
    next
  end

  html = File.read(html_path)
  expected_url = "#{BASE_URL}/blogs/#{post_id}/"
  expected_doi = zenodo.dig(post_id, "current_doi").to_s
  expected_doi = fm["doi"].to_s if expected_doi.empty?

  title_values = meta_values(html, "citation_title")
  errors << "#{path}: missing citation_title" if title_values.empty?
  errors << "#{path}: citation_title does not match frontmatter title" unless title_values.include?(fm["title"].to_s)

  author_values = meta_values(html, "citation_author")
  expected_authors(fm).each do |author|
    errors << "#{path}: missing citation_author for #{author}" unless author_values.include?(author)
  end

  publication_date = expected_publication_date(fm)
  unless meta_values(html, "citation_publication_date").include?(publication_date)
    errors << "#{path}: citation_publication_date must be #{publication_date}"
  end

  unless meta_values(html, "citation_fulltext_html_url").include?(expected_url)
    errors << "#{path}: citation_fulltext_html_url must be #{expected_url}"
  end

  unless journal_title.empty? || meta_values(html, "citation_journal_title").include?(journal_title)
    errors << "#{path}: citation_journal_title must be #{journal_title}"
  end

  if expected_doi.empty?
    errors << "#{path}: accepted post is missing Zenodo DOI metadata" if REQUIRE_ACCEPTED_DOI
    errors << "#{path}: Altmetric badge must not render without a DOI" unless altmetric_dois(html).empty?
    if html.include?("https://embed.altmetric.com/assets/embed.js")
      errors << "#{path}: Altmetric embed script must not load without a DOI"
    end
  elsif !meta_values(html, "citation_doi").include?(expected_doi)
    errors << "#{path}: citation_doi must be #{expected_doi}"
  else
    unless altmetric_dois(html).include?(expected_doi)
      errors << "#{path}: Altmetric badge data-doi must be #{expected_doi}"
    end

    embed_script_count = html.scan(%r{https://embed\.altmetric\.com/assets/embed\.js}).length
    errors << "#{path}: expected one Altmetric embed script, found #{embed_script_count}" unless embed_script_count == 1
  end

  if fm["pdf_url"] || fm["pdf"]
    errors << "#{path}: missing citation_pdf_url" if meta_values(html, "citation_pdf_url").empty?
  end

  robots = meta_values(html, "robots").join(",")
  errors << "#{path}: production article page must not be noindex" if robots.match?(/noindex/i)
end

if errors.any?
  warn "Scholar and Altmetric metadata validation failed:"
  errors.each { |error| warn "  - #{error}" }
  exit 1
end

puts "Scholar and Altmetric metadata validation passed."
