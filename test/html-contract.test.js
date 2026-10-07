import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(projectRoot, "index.html"), "utf8");

function attribute(openingTag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return openingTag.match(new RegExp(`\\b${escapedName}="([^"]+)"`, "i"))?.[1] ?? null;
}

test("HTML declares nine unique pads and each sound path points to a local WAV file", () => {
  const tags = [...html.matchAll(/<button\b[^>]*>/gi)].map(([tag]) => tag);
  const pads = tags
    .filter((tag) => attribute(tag, "data-pad-id"))
    .map((tag) => ({
      tag,
      padId: attribute(tag, "data-pad-id"),
      key: attribute(tag, "data-key"),
      source: attribute(tag, "data-sound"),
    }));

  assert.equal(pads.length, 9);
  assert.equal(new Set(pads.map(({ padId }) => padId)).size, 9);
  assert.equal(new Set(pads.map(({ key }) => key?.toLowerCase())).size, 9);

  for (const pad of pads) {
    assert.equal(attribute(pad.tag, "type"), "button");
    assert.match(pad.key ?? "", /^[a-z0-9]$/i);
    assert.match(pad.source ?? "", /^audio\/samples\/[a-z0-9-]+\.wav$/i);
    assert.ok(existsSync(resolve(projectRoot, pad.source)), `missing sample: ${pad.source}`);
  }
});

test("HTML contains no inline event handlers and loads only an external module script", () => {
  const openingTags = [...html.matchAll(/<[a-z][^>]*>/gi)].map(([tag]) => tag);
  assert.ok(openingTags.every((tag) => !/\son[a-z]+\s*=/i.test(tag)));
  const scripts = openingTags.filter((tag) => /^<script\b/i.test(tag));
  assert.deepEqual(scripts.map((tag) => ({
    type: attribute(tag, "type"),
    source: attribute(tag, "src"),
  })), [{ type: "module", source: "src/main.js" }]);
});

test("HTML points to a checked-in local favicon", () => {
  const iconTag = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .find((tag) => attribute(tag, "rel") === "icon");
  assert.ok(iconTag);
  assert.equal(attribute(iconTag, "href"), "favicon.svg");
  assert.ok(existsSync(resolve(projectRoot, "favicon.svg")));
});
