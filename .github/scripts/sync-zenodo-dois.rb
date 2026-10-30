#!/usr/bin/env ruby

require "json"
require "net/http"
require "time"
require "uri"
require "yaml"
require "fileutils"
require "pathname"
require "tmpdir"

ROOT = File.expand_path("../..", __dir__)
DATA_PATH = File.join(ROOT, "data", "zenodo.json")
SITE_URL = ENV.fetch("SITE_URL", "https://genomicsxai.github.io")
API_BASE = ENV.fetch("ZENODO_API_BASE", "https://zenodo.org/api")
TOKEN = ENV["ZENODO_API_TOKEN"].to_s.strip
COMMUNITY = ENV["ZENODO_COMMUNITY"].to_s.strip
DRY_RUN = ENV["DRY_RUN"] == "1"
# render-post-pdfs.sh, when the workflow can print PDFs (Hugo + Chrome).
PDF_RENDERER = ENV["PDF_RENDERER"].to_s.strip

def load_post(path)
  raw = File.read(path)
  match = raw.match(/\A---\s*\n(.*?)\n---\s*\n/m)
  raise "Missing frontmatter in #{path}" unless match

  frontmatter = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
  [frontmatter, raw[match[0].length..]]
end

def extract_summary(body)
  summary = body[/\{\{<\s*summary\s*>\}\}(.*?)\{\{<\s*\/summary\s*>\}\}/m, 1]
  text = (summary || body).dup
  text.gsub!(/`([^`]+)`/, '\1')
  text.gsub!(/\[([^\]]+)\]\([^)]+\)/, '\1')
  text.gsub!(/!\[([^\]]*)\]\([^)]+\)/, '\1')
  text.gsub!(/\{\{<[^>]+>\}\}/, "")
  text.gsub!(/^#+\s*/, "")
  text.gsub!(/\n{2,}/, "\n\n")
  text.strip!
  text = text[0, 4900] if text.length > 4900
  text.empty? ? "Blog post published on Genomics × AI." : text
end

def format_creator_name(name)
  return name if name.include?(",")
  parts = name.split(/\s+/)
  return name if parts.length < 2
  "#{parts[-1]}, #{parts[0..-2].join(' ')}"
end

def extract_creators(frontmatter)
  authors = frontmatter["authors_display"] || frontmatter["authors"] || []
  authors.map do |author|
    if author.is_a?(Hash)
      creator = { "name" => format_creator_name(author["name"].to_s) }
      creator["affiliation"] = author["affiliation"] if author["affiliation"].to_s != ""
      creator["orcid"] = author["orcid"] if author["orcid"].to_s != ""
      creator
    else
      { "name" => format_creator_name(author.to_s) }
    end
  end
end

def absolute_post_url(frontmatter)
  "#{SITE_URL}/blogs/#{frontmatter.fetch('post_id')}/"
end

def metadata_for(frontmatter, body, revision_number)
  {
    "title" => frontmatter.fetch("title"),
    "upload_type" => "publication",
    "publication_type" => "article",
    "publication_date" => frontmatter.fetch("date").to_s,
    "description" => extract_summary(body),
    "creators" => extract_creators(frontmatter),
    "access_right" => "open",
    "license" => "cc-by-4.0",
    "prereserve_doi" => true,
    "version" => "v#{revision_number}",
    "keywords" => Array(frontmatter["tags"]).map(&:to_s),
    "related_identifiers" => [
      {
        "identifier" => absolute_post_url(frontmatter),
        "relation" => "isAlternateIdentifier",
        "resource_type" => "publication-article"
      }
    ]
  }.tap do |metadata|
    metadata["communities"] = [{ "identifier" => COMMUNITY }] unless COMMUNITY.empty?
  end
end

def api_request(method, url, payload: nil)
  raise "ZENODO_API_TOKEN is not set" if TOKEN.empty?

  uri = URI(url)
  req = case method
        when :get then Net::HTTP::Get.new(uri)
        when :post then Net::HTTP::Post.new(uri)
        when :put then Net::HTTP::Put.new(uri)
        else raise "Unsupported method #{method}"
        end
  req["Authorization"] = "Bearer #{TOKEN}"
  req["Content-Type"] = "application/json"
  req.body = JSON.generate(payload) if payload

  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
    http.request(req)
  end

  body = response.body.to_s
  parsed = body.empty? ? {} : JSON.parse(body)
  unless response.code.to_i.between?(200, 299)
    raise "Zenodo API #{method.upcase} #{url} failed (#{response.code}): #{parsed}"
  end
  parsed
end

def api_upload_file(bucket_url, source_path, filename)
  raise "ZENODO_API_TOKEN is not set" if TOKEN.empty?

  uri = URI("#{bucket_url}/#{URI.encode_www_form_component(filename)}")
  req = Net::HTTP::Put.new(uri)
  req["Authorization"] = "Bearer #{TOKEN}"
  req["Content-Type"] = "application/octet-stream"
  req.body = File.binread(source_path)

  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
    http.request(req)
  end

  body = response.body.to_s
  parsed = body.empty? ? {} : JSON.parse(body)
  unless response.code.to_i.between?(200, 299)
    raise "Zenodo file upload #{filename} failed (#{response.code}): #{parsed}"
  end
  parsed
end

# Build output that sits beside a post's sources but is not part of them:
# CI's WebP derivatives (optimize-images.py) and the site's copy of the PDF.
def generated_file?(file, post_id)
  name = File.basename(file)
  File.fnmatch("*.optimized*.webp", name) || name == "#{post_id}.pdf"
end

def upload_post_files(draft, post_path, post_id, revision_number, pdf: nil)
  bucket_url = draft.dig("links", "bucket")
  raise "Zenodo draft response missing bucket link for #{post_id}" unless bucket_url

  post_dir = File.dirname(post_path)
  base = Pathname.new(post_dir)
  files = Dir.glob(File.join(post_dir, "*"))
             .select { |file| File.file?(file) && !generated_file?(file, post_id) }.sort
  raise "No files found to upload for #{post_id}" if files.empty?

  files.each do |file|
    relative = Pathname.new(file).relative_path_from(base).to_s
    filename = "#{post_id}-v#{revision_number}-#{relative}"
    api_upload_file(bucket_url, file, filename)
  end
  api_upload_file(bucket_url, pdf, "#{post_id}-v#{revision_number}.pdf") if pdf
end

# Print the post to PDF for its deposit, showing the DOI Zenodo has just
# reserved for this draft, so Zenodo can offer Google Scholar a full text.
# Returns the PDF's path, or nil. A failed print must not stop the DOI being
# minted: the deposit then goes out without a PDF, as every one did before.
def render_pdf(post_id, draft)
  return nil if PDF_RENDERER.empty?

  doi = draft.dig("metadata", "prereserve_doi", "doi").to_s
  pdf = File.join(Dir.mktmpdir("zenodo-pdf"), "#{post_id}.pdf")
  return pdf if system("bash", PDF_RENDERER, "--post", post_id, "--doi", doi, "--output", pdf) && File.size?(pdf)

  puts "::warning::Could not print #{post_id} to PDF; its Zenodo deposit will not include one."
  nil
end

def create_initial_draft(metadata)
  draft = api_request(:post, "#{API_BASE}/deposit/depositions", payload: {})
  update_draft_metadata(draft.fetch("id"), metadata)
end

def create_new_version(current_deposition_id)
  api_request(:post, "#{API_BASE}/deposit/depositions/#{current_deposition_id}/actions/newversion")
end

def update_draft_metadata(draft_id, metadata)
  api_request(:put, "#{API_BASE}/deposit/depositions/#{draft_id}", payload: { metadata: metadata })
end

def publish_draft(draft_id)
  api_request(:post, "#{API_BASE}/deposit/depositions/#{draft_id}/actions/publish")
end

def current_revision(frontmatter)
  explicit = frontmatter["revision"]
  return explicit.to_i if explicit
  history = Array(frontmatter["revision_history"])
  return history.last["version"].to_i unless history.empty?
  1
end

def revision_entry(frontmatter, revision_number)
  history = Array(frontmatter["revision_history"])
  history.find { |entry| entry["version"].to_i == revision_number } || history.last || {}
end

def load_store
  return {} unless File.exist?(DATA_PATH)
  JSON.parse(File.read(DATA_PATH))
end

def save_store(store)
  FileUtils.mkdir_p(File.dirname(DATA_PATH))
  File.write(DATA_PATH, JSON.pretty_generate(store) + "\n")
end

store = load_store
changed = ARGV.empty? ? Dir.glob(File.join(ROOT, "content", "blogs", "*", "index.md")).sort : ARGV
updated = false

changed.each do |path|
  frontmatter, body = load_post(path)
  post_id = frontmatter["post_id"].to_s
  next if post_id.empty?
  next unless frontmatter["status"].to_s == "accepted"

  revision_number = current_revision(frontmatter)
  revision = revision_entry(frontmatter, revision_number)
  entry = store[post_id] || {}
  revision_map = entry["revisions"] || {}

  if frontmatter["doi"].to_s != "" && !revision_map.key?(revision_number.to_s)
    revision_map[revision_number.to_s] = {
      "doi" => frontmatter["doi"],
      "zenodo_url" => frontmatter["zenodo_url"],
      "date" => revision["date"].to_s,
      "notes" => revision["notes"].to_s
    }
    entry["current_revision"] = revision_number
    entry["current_doi"] = frontmatter["doi"]
    entry["current_zenodo_url"] = frontmatter["zenodo_url"]
    entry["revisions"] = revision_map
    store[post_id] = entry
    updated = true
    next
  end

  next if revision_map.key?(revision_number.to_s)

  if DRY_RUN
    puts "[DRY RUN] Would sync Zenodo DOI for #{post_id} revision #{revision_number}"
    next
  end

  metadata = metadata_for(frontmatter, body, revision_number)
  published =
    if entry["current_deposition_id"]
      new_version = create_new_version(entry["current_deposition_id"])
      latest_draft = new_version.dig("links", "latest_draft")
      raise "Zenodo newversion response missing latest_draft for #{post_id}" unless latest_draft
      draft = api_request(:get, latest_draft)
      draft = update_draft_metadata(draft.fetch("id"), metadata)
      upload_post_files(draft, path, post_id, revision_number, pdf: render_pdf(post_id, draft))
      publish_draft(draft.fetch("id"))
    else
      draft = create_initial_draft(metadata)
      upload_post_files(draft, path, post_id, revision_number, pdf: render_pdf(post_id, draft))
      publish_draft(draft.fetch("id"))
    end

  doi = published["doi"].to_s
  doi_url = published["doi_url"].to_s
  zenodo_url = published["record_url"].to_s
  zenodo_url = published.dig("links", "html").to_s if zenodo_url.empty?
  deposition_id = published["id"]

  revision_map[revision_number.to_s] = {
    "doi" => doi,
    "doi_url" => doi_url,
    "zenodo_url" => zenodo_url,
    "deposition_id" => deposition_id,
    "record_id" => published["record_id"],
    "date" => revision["date"].to_s,
    "notes" => revision["notes"].to_s
  }

  entry["conceptrecid"] = published["conceptrecid"] if published["conceptrecid"]
  entry["current_revision"] = revision_number
  entry["current_doi"] = doi
  entry["current_doi_url"] = doi_url
  entry["current_zenodo_url"] = zenodo_url
  entry["current_deposition_id"] = deposition_id
  entry["revisions"] = revision_map
  store[post_id] = entry
  updated = true
end

save_store(store) if updated
puts(updated ? "Zenodo metadata updated." : "No Zenodo metadata changes needed.")
