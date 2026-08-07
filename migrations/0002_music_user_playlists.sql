UPDATE content_sections
SET content_json = json_set(content_json, '$.playlistIds', json('[]')),
    revision = revision + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE section_key = 'music';

DELETE FROM admin_mutations
WHERE section_key = 'music';
