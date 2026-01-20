var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-LZ8L1I/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// meta-injector.js
var BOT_USER_AGENTS = [
  // Search Engines
  "googlebot",
  "bingbot",
  "slurp",
  // Yahoo
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  // Social Media
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegram",
  "slackbot",
  "discordbot",
  // AI Bots
  "gptbot",
  "chatgpt-user",
  "claude-web",
  "claudebot",
  "anthropic-ai",
  "perplexitybot",
  "google-extended"
];
var meta_injector_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get("User-Agent") || "";
    if (!isBot(userAgent) || !isHTMLRequest(request)) {
      return fetch(request);
    }
    console.log(`[Bot Detected] ${userAgent.substring(0, 50)}... | ${url.pathname}${url.search}`);
    const scene = url.searchParams.get("scene");
    const artist = url.searchParams.get("artist");
    const venue = url.searchParams.get("venue");
    const response = await fetch(request);
    const contentType = response.headers.get("Content-Type") || "";
    if (!response.ok || !contentType.includes("text/html")) {
      return response;
    }
    let html = await response.text();
    if (scene === "artists" && artist) {
      html = await injectArtistMeta(html, artist, url.origin);
    } else if ((scene === "venues" || scene === "geography") && venue) {
      html = await injectVenueMeta(html, venue, url.origin, scene);
    }
    return new Response(html, {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=3600"
        // Cache bot responses for 1 hour
      }
    });
  }
};
function isBot(userAgent) {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}
__name(isBot, "isBot");
function isHTMLRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get("Accept") || "";
  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/assets/") || url.pathname.match(/\.(js|css|json|jpg|png|svg|ico|xml|txt)$/)) {
    return false;
  }
  return accept.includes("text/html") || accept.includes("*/*");
}
__name(isHTMLRequest, "isHTMLRequest");
async function injectArtistMeta(html, artistNormalized, origin) {
  try {
    const artistsResponse = await fetch(`${origin}/data/artists-metadata.json`);
    if (!artistsResponse.ok) {
      console.error("Failed to fetch artists-metadata.json");
      return html;
    }
    const artistsData = await artistsResponse.json();
    const metadata = artistsData[artistNormalized];
    if (!metadata) {
      console.warn(`Artist not found: ${artistNormalized}`);
      return html;
    }
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
    if (!concertsResponse.ok) {
      console.error("Failed to fetch concerts.json");
      return html;
    }
    const concertsData = await concertsResponse.json();
    const artistConcerts = concertsData.concerts.filter(
      (c) => c.headlinerNormalized === artistNormalized
    );
    const concertCount = artistConcerts.length;
    const years = artistConcerts.map((c) => c.year).sort();
    const dateRange = years.length > 0 ? `${years[0]}-${years[years.length - 1]}` : "various years";
    const title = `${metadata.name} - Morperhaus Concert Archives`;
    const description = `${concertCount} ${concertCount === 1 ? "concert" : "concerts"} from ${dateRange}. Explore setlists, tour history, and venue details for ${metadata.name}.`;
    const imageUrl = metadata.image || `${origin}/og-image.jpg`;
    const pageUrl = `${origin}/?scene=artists&artist=${artistNormalized}`;
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`
    );
    html = html.replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
    );
    html = html.replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      `<meta property="twitter:description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="twitter:image" content="[^"]*" \/>/,
      `<meta property="twitter:image" content="${escapeHtml(imageUrl)}" />`
    );
    console.log(`[Artist Meta Injected] ${metadata.name} (${concertCount} concerts)`);
    return html;
  } catch (error) {
    console.error(`Error injecting artist meta: ${error.message}`);
    return html;
  }
}
__name(injectArtistMeta, "injectArtistMeta");
async function injectVenueMeta(html, venueNormalized, origin, scene) {
  try {
    const venuesResponse = await fetch(`${origin}/data/venues-metadata.json`);
    if (!venuesResponse.ok) {
      console.error("Failed to fetch venues-metadata.json");
      return html;
    }
    const venuesData = await venuesResponse.json();
    const metadata = venuesData[venueNormalized];
    if (!metadata) {
      console.warn(`Venue not found: ${venueNormalized}`);
      return html;
    }
    const concertsResponse = await fetch(`${origin}/data/concerts.json`);
    if (!concertsResponse.ok) {
      console.error("Failed to fetch concerts.json");
      return html;
    }
    const concertsData = await concertsResponse.json();
    const venueConcerts = concertsData.concerts.filter(
      (c) => c.venueNormalized === venueNormalized
    );
    const concertCount = venueConcerts.length;
    const artistCounts = {};
    venueConcerts.forEach((c) => {
      artistCounts[c.headliner] = (artistCounts[c.headliner] || 0) + 1;
    });
    const topArtists = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]).slice(0, 3);
    const sceneLabel = scene === "geography" ? "Map" : "Network";
    const title = `${metadata.name} - Morperhaus Concert Archives`;
    const description = `${concertCount} ${concertCount === 1 ? "concert" : "concerts"} at ${metadata.name} in ${metadata.city}, ${metadata.state}. Featured artists: ${topArtists.join(", ")}.`;
    const pageUrl = `${origin}/?scene=${scene}&venue=${venueNormalized}`;
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`
    );
    html = html.replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`
    );
    html = html.replace(
      /<meta property="twitter:description" content="[^"]*" \/>/,
      `<meta property="twitter:description" content="${escapeHtml(description)}" />`
    );
    console.log(`[Venue Meta Injected] ${metadata.name} (${concertCount} concerts, ${sceneLabel} scene)`);
    return html;
  } catch (error) {
    console.error(`Error injecting venue meta: ${error.message}`);
    return html;
  }
}
__name(injectVenueMeta, "injectVenueMeta");
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
__name(escapeHtml, "escapeHtml");

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-LZ8L1I/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = meta_injector_default;

// ../../../../../opt/homebrew/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-LZ8L1I/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=meta-injector.js.map
