"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

class LeadStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "leads.json");
    this.cache = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      this.cache = JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.cache = {};
      await this.flush();
    }
  }

  async ensure() {
    if (!this.cache) await this.init();
  }

  async get(id) {
    await this.ensure();
    return this.cache[id] || null;
  }

  async save(lead) {
    await this.ensure();
    this.cache[lead.id] = lead;
    await this.flush();
    return lead;
  }

  async list() {
    await this.ensure();
    return Object.values(this.cache).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }

  async flush() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.file}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(this.cache, null, 2), "utf8");
      await fs.rename(temporary, this.file);
    });
    return this.writeQueue;
  }
}

module.exports = { LeadStore };
