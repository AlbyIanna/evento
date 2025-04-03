// Cache for templates
const templateCache = new Map();

export async function loadTemplate(path) {
  try {
    // Check if template is already in cache
    if (templateCache.has(path)) {
      return templateCache.get(path);
    }

    // Use absolute path from root
    const absolutePath = path.startsWith('./') ? path.substring(1) : path;
    const url = new URL(absolutePath, window.location.origin);
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to load template: ${path}`);
    }
    // If the body has already been used, we can't read it again
    if (response.bodyUsed) {
      throw new Error('Response body has already been read');
    }
    const template = await response.text();

    // Cache the template
    templateCache.set(path, template);
    return template;
  } catch (error) {
    console.error('Template loading error:', error);
    throw error;
  }
}
