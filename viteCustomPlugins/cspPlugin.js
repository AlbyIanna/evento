/*
    @description: Custom CSP Plugin that accepts a configuration object
    @param {Object} policies - The policies to apply to the CSP.
    @returns {Object} The plugin configuration. 
*/
export function cspPlugin(policies = {}) {
  // Default policies
  const defaultPolicies = {
    'default-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com']
    // Add other defaults as needed
  };

  // Merge provided policies with defaults
  const mergedPolicies = { ...defaultPolicies, ...policies };

  // Build the policy string from the merged policies object
  const policyString = Object.entries(mergedPolicies)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');

  return {
    name: 'csp-plugin',
    transformIndexHtml(html) {
      const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${policyString}">`;
      return html.replace(/<head>/, `<head>\n  ${cspMetaTag}`);
    }
  };
}
